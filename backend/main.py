"""
O'Clock — Roue de la fortune dominicale
Backend FastAPI. Le résultat de la roue est TOUJOURS calculé côté serveur.

Règles :
- Ouverte uniquement le dimanche de 18h00 à 19h00 (Europe/Paris).
- Anti-fraude : 1 participation par @pseudo par session dominicale.
- Compteur de 3 lots physiques max (cases 1-5) par session.
  Tant que < 3 lots physiques distribués : 8 cases à poids égaux.
  Dès 3 lots atteints : cases 1-5 à 0%, seules 6/7/8 possibles.
"""

import os
import random
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, time
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TZ = ZoneInfo("Europe/Paris")
OPEN_TIME = time(18, 0)
CLOSE_TIME = time(19, 0)
SUNDAY = 6  # datetime.weekday() : lundi=0 ... dimanche=6
DB_PATH = "oclock.db"
MAX_PHYSICAL_PRIZES = 3
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "123456789")

# index -> (label, is_physical, image_slug)
# image_slug pointe vers /prizes/<slug>.jpg (grand) et <slug>-thumb.png (roue)
PRIZES = [
    ("4 mini burgers", True, "mini-burgers"),        # 0 -> case 1
    ("Burger fondu", True, "burger-fondu"),          # 1 -> case 2
    ("Tacos fondu", True, "tacos-fondu"),            # 2 -> case 3
    ("Chicken fries", True, "chicken-fries"),        # 3 -> case 4
    ("Big chicken burger", True, "big-chicken-burger"),  # 4 -> case 5
    ("10 % sur votre commande", False, None),        # 5 -> case 6
    ("5 % sur votre commande", False, None),         # 6 -> case 7
    ("Essaie le prochain dimanche", False, None),    # 7 -> case 8
]
PHYSICAL_INDICES = [i for i, p in enumerate(PRIZES) if p[1]]
NON_PHYSICAL_INDICES = [i for i, p in enumerate(PRIZES) if not p[1]]


# ---------------------------------------------------------------------------
# Base de données
# ---------------------------------------------------------------------------

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS participations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_date TEXT NOT NULL,
                pseudo TEXT NOT NULL,
                prize_index INTEGER NOT NULL,
                prize_label TEXT NOT NULL,
                is_physical INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(session_date, pseudo)
            )
            """
        )


# ---------------------------------------------------------------------------
# Logique métier
# ---------------------------------------------------------------------------

def now_paris() -> datetime:
    return datetime.now(TZ)


def is_open(dt: datetime) -> bool:
    if dt.weekday() != SUNDAY:
        return False
    return OPEN_TIME <= dt.time() < CLOSE_TIME


def session_key(dt: datetime) -> str:
    """Identifie la session dominicale par sa date (YYYY-MM-DD)."""
    return dt.date().isoformat()


def physical_count(conn, session: str) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM participations "
        "WHERE session_date = ? AND is_physical = 1",
        (session,),
    ).fetchone()
    return row["c"]


def already_played(conn, session: str, pseudo: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM participations WHERE session_date = ? AND pseudo = ?",
        (session, pseudo),
    ).fetchone()
    return row is not None


def pick_prize(conn, session: str) -> int:
    """Tire un index gagnant côté serveur selon les règles."""
    if physical_count(conn, session) >= MAX_PHYSICAL_PRIZES:
        # Les 3 lots sont partis : uniquement cases 6, 7, 8.
        return random.choice(NON_PHYSICAL_INDICES)
    # Sinon : poids égaux sur les 8 cases.
    return random.randrange(len(PRIZES))


def normalize_pseudo(raw: str) -> str:
    p = raw.strip().lstrip("@").lower()
    return "@" + p


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class SpinRequest(BaseModel):
    pseudo: str

    @field_validator("pseudo")
    @classmethod
    def validate_pseudo(cls, v: str) -> str:
        cleaned = v.strip().lstrip("@")
        if not cleaned:
            raise ValueError("Le pseudo Instagram est obligatoire.")
        if len(cleaned) > 30 or not all(
            c.isalnum() or c in "._" for c in cleaned
        ):
            raise ValueError("Pseudo Instagram invalide.")
        return cleaned


class SpinResponse(BaseModel):
    prize_index: int
    prize_label: str
    is_physical: bool
    image_slug: str | None


app = FastAPI(title="O'Clock Wheel")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre à ton domaine en prod
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/status")
def status():
    dt = now_paris()
    return {
        "open": is_open(dt),
        "server_time": dt.isoformat(),
        "message": "Roue fermée, reviens dimanche 18h-19h"
        if not is_open(dt)
        else "Roue ouverte !",
    }


@app.post("/api/spin", response_model=SpinResponse)
def spin(req: SpinRequest):
    dt = now_paris()

    if not is_open(dt):
        raise HTTPException(
            status_code=403,
            detail="Roue fermée, reviens dimanche 18h-19h",
        )

    session = session_key(dt)
    pseudo = normalize_pseudo(req.pseudo)

    with get_db() as conn:
        if already_played(conn, session, pseudo):
            raise HTTPException(
                status_code=409,
                detail="Tu as déjà tenté ta chance ce dimanche !",
            )

        index = pick_prize(conn, session)
        label, is_physical, image_slug = PRIZES[index]

        try:
            conn.execute(
                "INSERT INTO participations "
                "(session_date, pseudo, prize_index, prize_label, "
                "is_physical, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (session, pseudo, index, label, int(is_physical),
                 dt.isoformat()),
            )
        except sqlite3.IntegrityError:
            # Course entre deux requêtes du même pseudo.
            raise HTTPException(
                status_code=409,
                detail="Tu as déjà tenté ta chance ce dimanche !",
            )

        if is_physical:
            print(f"🎉 Gagnant validé : {pseudo} a gagné {label}")

    return SpinResponse(
        prize_index=index,
        prize_label=label,
        is_physical=is_physical,
        image_slug=image_slug,
    )


# ---------------------------------------------------------------------------
# Admin : liste des gagnants en direct + total participants
# ---------------------------------------------------------------------------

def check_admin(password: str):
    if not secrets.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect.")


@app.get("/api/admin/winners")
def admin_winners(password: str):
    check_admin(password)
    dt = now_paris()
    session = session_key(dt)
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM participations WHERE session_date = ?",
            (session,),
        ).fetchone()["c"]
        physical = physical_count(conn, session)
        # Gagnants = tout sauf la case perdante (index 7).
        rows = conn.execute(
            "SELECT pseudo, prize_label, is_physical, created_at "
            "FROM participations "
            "WHERE session_date = ? AND prize_index != 7 "
            "ORDER BY created_at DESC",
            (session,),
        ).fetchall()
    winners = [
        {
            "pseudo": r["pseudo"],
            "prize_label": r["prize_label"],
            "is_physical": bool(r["is_physical"]),
            "time": r["created_at"],
        }
        for r in rows
    ]
    return {
        "session_date": session,
        "total_participants": total,
        "physical_prizes_given": physical,
        "physical_prizes_left": max(0, MAX_PHYSICAL_PRIZES - physical),
        "winners": winners,
    }
