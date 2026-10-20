import os
import logging
import base64
import json
import hashlib
import re
import io
import asyncio
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, Request, Response, HTTPException, Query, BackgroundTasks, File, UploadFile, Form
from fastapi.responses import PlainTextResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
import unicodedata

# Modulos locales del chatbot
from prompt import SYSTEM_PROMPT
from geo_utils import calculate_delivery_cost
from client_db import get_client_data, save_client_info, increment_approved_order_count, get_client_delivery_cost

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower().strip()

PRODUCT_IMAGE_MAP = {
    # Waffles
    "waffle frutos del bosque": "WAFFLE_FRUTOS_DEL_BOSQUE.png",
    "waffle frutos rojos": "WAFFLE_FRUTOS_DEL_BOSQUE.png",
    "waffle pop": "WAFFLE_POP.png",
    "waffle tropical": "WAFFLE_TROPICAL.png",
    "waffle nutella": "WAFFLE_NUTELLA.png",
    "waffle fresa split": "WAFFLE_FRESA_SPLIT.png",
    "waffle banana split": "WAFFLE_BANANA_SPLIT.png",
    "waffle manjar": "WAFFLE_MANJAR.png",
    "waffle oreo": "WAFFLE_OREO.png",
    "waffle kiwi": "WAFFLE_KIWI.png",
    "waffle kiwiberry": "WAFFLE_KIWI.png",
    "waffle brownie": "WAFFLE_BROWNIE.png",
    
    # Frappés
    "frappe cafe": "FRAPPE_CAFÉ.png",
    "frappe moca": "FRAPPE_MOCA.png",
    "frappe mocha": "FRAPPE_MOCA.png",
    "frappe oreo": "FRAPPE_OREO.png",
    "frappe chocoberry": "FRAPPE_CHOCOBERRY.png",
    "frappe strawberry": "FRAPPE_STRAWBERRY.png",
    "frappe fresa": "FRAPPE_STRAWBERRY.png",
    "frappe berries": "FRAPPE_BERRIES.png",
    "frappe caramel clasico": "FRAPPE_CARAMEL_CLÁSICO.png",
    "frappe caramel chocolate": "FRAPPE_CARAMEL_CHOCOLATE.png",
    "frappe chocolucuma": "FRAPPE_CHOCOLÚCUMA.png",
    "frappe algarrolucuma": "FRAPPE_ALGARROLÚCUMA.png",
    "frappe algarrobina": "FRAPPE_ALGARROLÚCUMA.png",
    "frappe maracuya": "FRAPPE_MARACUYÁ.png",
    "frappe fit": "FRAPPE_FIT.png",
    
    # Frozens
    "frozen limonada": "FROZEN_LIMONADA.png",
    "limonada frozen": "FROZEN_LIMONADA.png",
    "frozen maracuya": "FROZEN_MARACUYÁ.png",
    "maracuya frozen": "FROZEN_MARACUYÁ.png",
    "frozen strawberry": "FROZEN_STRAWBERRY.png",
    "frozen fresa": "FROZEN_STRAWBERRY.png",
    "strawberry frozen": "FROZEN_STRAWBERRY.png",
    
    # Bebidas Calientes
    "americano": "AMERICANO.png",
    "cafe americano": "AMERICANO.png",
    "cappuccino": "CAPUCCINO.png",
    "capuccino": "CAPUCCINO.png",
    "chocolate": "CHOCOLATE.png",
    "chocolate caliente": "CHOCOLATE.png",
    "mocaccino": "MOCACCINO.png",
    "moccacino": "MOCACCINO.png",
    "moca caliente": "MOCACCINO.png",
    "caramel macchiato": "CARAMEL_MACCHIATO.png",
    "oreo latte": "OREO_LATTE.png",
    "latte vainilla": "LATTE_VAINILLA.png",
    "late vainilla": "LATTE_VAINILLA.png",
    "choconube": "CHOCONUBE.png",
    "saltamel brownie": "SALTAMEL_BROWNIE.png",
    "canelatte caramel": "CANELATTE_CARAMEL.png",
    "canelatte": "CANELATTE_CARAMEL.png",
    "capiberry vainilla": "CAPRIBERRY_VAINILLA.png",
    "capiberry": "CAPRIBERRY_VAINILLA.png",
    
    # Bebidas Iced (Frías)
    "iced coffee": "ICED_COFFEE.png",
    "americano frio": "ICED_COFFEE.png",
    "iced latte coffee": "ICED_LATTE_COFFEE.png",
    "iced latte": "ICED_LATTE_COFFEE.png",
    "cappuccino frio": "ICED_LATTE_COFFEE.png",
    "iced chocolate": "ICED_CHOCOLATE.png",
    "chocolate frio": "ICED_CHOCOLATE.png",
    "iced berry": "ICED_BERRY.png",
    
    # Salados
    "sandwich clasico": "SANDWICH_CLÁSICO.png",
    "sandwich especial": "SANDWICH_ESPECIAL.png",
    "suprema": "SUPREMA.png",
    "parrillero": "PARRILLERO.png",
    "club sandwich": "CLUB_SANDWICH.png",
    "caprisabroso": "CAPRISABROSO.png",
    "petit pan": "PETIT_PAN.png",
    
    # Croissants Artesanales
    "croissant": "CROISSANT-POLLO.png",
    "croissant artesanal": "CROISSANT-POLLO.png",
    "croissant de pollo y frutos secos": "CROISSANT-POLLO.png",
    "croissant pollo y frutos secos": "CROISSANT-POLLO.png",
    "croissant de pollo": "CROISSANT-POLLO.png",
    "croissant pollo": "CROISSANT-POLLO.png",
    "croissant de jamon y queso": "CROISSANT-JAMONYQUESO.png",
    "croissant jamon y queso": "CROISSANT-JAMONYQUESO.png",
    "croissant de jamon": "CROISSANT-JAMONYQUESO.png",
    "croissant jamon": "CROISSANT-JAMONYQUESO.png",
    "croissant de cacao": "CROISSANT-CACAO.png",
    "croissant cacao": "CROISSANT-CACAO.png",
    "croissant de chocolate": "CROISSANT-CACAO.png",
    "croissant chocolate": "CROISSANT-CACAO.png",
    
    # Postres y Donas
    "dona de chocolate negro": "DONA_CHOCOLATE_NEGRO.png",
    "dona de chocolate blanco": "DONA_CHOCOLATE_BLANCO.png",
    "dona de fresa": "DONA_FRESA.png",
    "dona de glass": "DONA_GLASS.png",
    "dona de crema pastelera": "DONA_GLASS.png",
    "dona de manjar blanco": "DONA_MANJAR_BLANCO.png",
    "dona de manjar": "DONA_MANJAR_BLANCO.png",
    "dona de oreo": "DONA_OREO.png",
    "galleta": "GALLETA.png",
    "galletas": "GALLETA.png",
    "torta de chocolate": "TORTA_DE_CHOCOLATE.png",
    "crema volteada": "CREMA_VOLTEADA.png",
    "pie de limon": "PIE_DE_LIMON.jpeg",
    "tartaleta": "TARTALETA_FRUTOS_MIXTO.png",
    "tartaleta de frutas": "TARTALETA_FRUTOS_MIXTO.png",
    "tartaleta de frutos mixto": "TARTALETA_FRUTOS_MIXTO.png",
    "gelatina mosaico": "GELATINA_MOSAICO.png",
    "carrot cake": "CARROT_CAKE_TAJADA.png",
    "carrot cake tajada": "CARROT_CAKE_TAJADA.png",
    "keke de zanahoria": "CARROT_CAKE_TAJADA.png",
    "keke marmoleado": "KEKE_MARMOLEADO_TAJADA.png",
    "keke marmoleado tajada": "KEKE_MARMOLEADO_TAJADA.png",
    "marmoleado tajada": "KEKE_MARMOLEADO_TAJADA.png",
    "carrot cake familiar": "CARROT_CAKE_ENTERO.png",
    "carrot cake entero": "CARROT_CAKE_ENTERO.png",
    "carrot cake cumpleañero": "CARROT_CAKE_CUMPLEAÑERO.png",
    "marmoleado familiar": "KEKE_MARMOLEADO_ENTERO.png",
    "marmoleado cumpleañero": "KEKE_MARMOLEADO_ENTERO.png",
    "keke marmoleado entero": "KEKE_MARMOLEADO_ENTERO.png",
    
    # Combos
    "1/2 docena donuts": "MEDIA_DOCENA_DONAS.png",
    "media docena de donas": "MEDIA_DOCENA_DONAS.png",
    "media docena donas": "MEDIA_DOCENA_DONAS.png",
    "1/2 docena galletas": "MEDIA_DOCENA_GALLETAS.png",
    "media docena de galletas": "MEDIA_DOCENA_GALLETAS.png",
    "media docena galletas": "MEDIA_DOCENA_GALLETAS.png",
    "duo compartir": "DUO_COMPARTIR.png",
    "combo duo compartir": "DUO_COMPARTIR.png",
    "duo irresistible": "DUO_IRRESISTIBLE.png",
    "combo duo irresistible": "DUO_IRRESISTIBLE.png",
    "cajita caprikids": "caprikids.jpg",
    "caprikids": "caprikids.jpg",
    "cajita feliz": "caprikids.jpg",
    
    # Promo Pack Amarillo (21/09/2026)
    "pack amarillo": "PACK_AMARILLO.jpeg",
    "combo amarillo": "PACK_AMARILLO.jpeg",
    "promo amarilla": "PACK_AMARILLO.jpeg",
    "promo amarillo": "PACK_AMARILLO.jpeg",
    "flores amarillas": "PACK_AMARILLO.jpeg",
    "rosas amarillas": "PACK_AMARILLO.jpeg",
    "combo flores amarillas": "PACK_AMARILLO.jpeg",
    "pack flores amarillas": "PACK_AMARILLO.jpeg",
    "pack de flores amarillas": "PACK_AMARILLO.jpeg",
    "pack rosas amarillas": "PACK_AMARILLO.jpeg",
    
    # Termo Caprichos 20oz (Tyeso)
    "termo caprichos": "TERMO_CAPRICHOS_20OZ.jpeg",
    "termo": "TERMO_CAPRICHOS_20OZ.jpeg",
    "termo 20oz": "TERMO_CAPRICHOS_20OZ.jpeg",
    "termo tyeso": "TERMO_CAPRICHOS_20OZ.jpeg",
    "vaso termico": "TERMO_CAPRICHOS_20OZ.jpeg",
    "termo personalizado": "TERMO_CAPRICHOS_20OZ.jpeg",
    "colores termo": "COLORES_TERMOS.jpeg",
    "colores termos": "COLORES_TERMOS.jpeg",
    "colores de termos": "COLORES_TERMOS.jpeg",
    "termo colores": "COLORES_TERMOS.jpeg",
    
    # Carta completa en imágenes
    "carta": "CARTA_BEBIDAS.png",
    "carta bebidas": "CARTA_BEBIDAS.png",
    "carta salados": "CARTA_SALADOS.png",
    "carta completa": "CARTA_BEBIDAS.png",
    "fotos de la carta": "CARTA_BEBIDAS.png",
    "imagenes de la carta": "CARTA_BEBIDAS.png",
}

def find_product_image(query: str) -> str:
    """Busca el archivo de imagen correspondiente en assets/ para un nombre de producto."""
    if not query:
        return None
    norm_q = normalize_text(query)
    
    # 1. Búsqueda exacta en mapa
    if norm_q in PRODUCT_IMAGE_MAP:
        img_name = PRODUCT_IMAGE_MAP[norm_q]
        path = os.path.join("assets", img_name)
        if os.path.exists(path):
            return path
            
    # 2. Búsqueda por subcadena en mapa
    for key, img_name in PRODUCT_IMAGE_MAP.items():
        if key in norm_q or norm_q in key:
            path = os.path.join("assets", img_name)
            if os.path.exists(path):
                return path
                
    # 3. Búsqueda directa en los nombres de archivo de la carpeta assets
    if os.path.exists("assets"):
        for f in os.listdir("assets"):
            norm_f = normalize_text(f).replace(".png", "").replace(".jpg", "").replace(".jpeg", "").replace("_", " ")
            if norm_f in norm_q or norm_q in norm_f:
                return os.path.join("assets", f)
                
    return None


# Configuración de Logs
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "mi_token_secreto_verificacion").strip('"').strip("'")
ADMIN_WHATSAPP_NUMBERS = [p.strip() for p in os.getenv("ADMIN_WHATSAPP_NUMBERS", "51977503006").split(",") if p.strip()]

# Credenciales y Autenticación del Panel Web (/admin)
ADMIN_PANEL_USER = os.getenv("ADMIN_PANEL_USER", "AdminKevin").strip()
ADMIN_PANEL_PASSWORD = os.getenv("ADMIN_PANEL_PASSWORD", "Capribot2026*").strip()
ADMIN_SESSION_TOKEN = hashlib.sha256(f"{ADMIN_PANEL_USER}:{ADMIN_PANEL_PASSWORD}:caprichos_2026_salt".encode()).hexdigest()

def is_admin_authenticated(request: Request) -> bool:
    token = request.cookies.get("caprichos_admin_session") or request.headers.get("X-Admin-Token")
    return token == ADMIN_SESSION_TOKEN

# Inicializar Cliente OpenAI
client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Memoria de sesiones por número de WhatsApp (ej. '51999999999')
user_sessions = {}
user_gps = {}
user_names = {}
user_last_activity = {}
chat_logs_history = {}
chat_log_counter = 0
CURRENT_PROMPT = SYSTEM_PROMPT
alta_demanda_mode = False
attended_chats = set()
unread_chats = set()
unread_counts = {} # phone -> count of unread messages
recently_approved_chats = set()
requires_worker_chats = {} # phone -> reason text
pending_registration_users = set() # Usuarios nuevos pendientes de brindar nombre y celular
waiting_order_query_users = set() # Usuarios que consultaron por pedido web esperando enviar datos
pending_validation_users_wa = set()
latest_order_summaries = {} # phone -> último ticket / resumen de pedido para POS

CHAT_HISTORY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat_history.json")
SESSIONS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_sessions.json")

def format_peru_phone(phone: str) -> str:
    """Formatea un número de celular a formato peruano 9XX XXX XXX o legible."""
    if not phone:
        return ""
    clean = re.sub(r"\D", "", str(phone).strip())
    if clean.startswith("51") and len(clean) == 11:
        clean = clean[2:]
    if len(clean) == 9:
        return f"{clean[:3]} {clean[3:6]} {clean[6:]}"
    return str(phone)

def get_national_peru_phone(phone: str) -> str:
    """Extrae los 9 dígitos nacionales del celular peruano."""
    if not phone:
        return ""
    clean = re.sub(r"\D", "", str(phone).strip())
    if clean.startswith("51") and len(clean) == 11:
        return clean[2:]
    return clean

def parse_timestamp_to_epoch(ts) -> float | None:
    """Convierte de forma segura cualquier timestamp (int, float o str formateado) a epoch float."""
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        return float(ts)
    if isinstance(ts, str):
        ts = ts.strip()
        try:
            return float(ts)
        except ValueError:
            pass
        lima_tz = pytz.timezone('America/Lima')
        for fmt in ('%Y-%m-%d %I:%M:%S %p', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S'):
            try:
                dt = datetime.strptime(ts, fmt)
                dt = lima_tz.localize(dt)
                return dt.timestamp()
            except ValueError:
                pass
    return None

MAX_ACTIVE_LOGS_PER_CHAT = 25
CHAT_HISTORY_ARCHIVE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat_history_archive.json")

def archive_old_chat_logs(archived_entries: dict):
    """Guarda mensajes antiguos (>25) en chat_history_archive.json de manera acumulativa."""
    if not archived_entries:
        return
    try:
        archive_data = {}
        if os.path.exists(CHAT_HISTORY_ARCHIVE_FILE):
            try:
                with open(CHAT_HISTORY_ARCHIVE_FILE, "r", encoding="utf-8") as f:
                    archive_data = json.load(f)
            except Exception:
                archive_data = {}
        
        for phone, old_msgs in archived_entries.items():
            if phone not in archive_data:
                archive_data[phone] = []
            archive_data[phone].extend(old_msgs)
            
        atomic_json_dump(CHAT_HISTORY_ARCHIVE_FILE, archive_data)
        logger.info(f"📦 {sum(len(v) for v in archived_entries.values())} mensajes antiguos archivados en {CHAT_HISTORY_ARCHIVE_FILE}")
    except Exception as e:
        logger.error(f"❌ Error al archivar mensajes en {CHAT_HISTORY_ARCHIVE_FILE}: {e}")

def atomic_json_dump(filepath: str, data: dict):
    """Guarda datos JSON usando archivo temporal y reemplazo seguro para evitar corrupción."""
    tmp_file = filepath + ".tmp"
    try:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        try:
            os.replace(tmp_file, filepath)
        except OSError:
            import shutil
            shutil.move(tmp_file, filepath)
    except Exception as e:
        logger.error(f"❌ Error en atomic_json_dump({filepath}): {e}")
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e2:
            logger.error(f"❌ Error en guardado directo fallback {filepath}: {e2}")
        if os.path.exists(tmp_file):
            try:
                os.remove(tmp_file)
            except Exception:
                pass

def get_client_display_name(phone: str) -> str:
    """Obtiene el nombre real del cliente, asegurando que nunca sea 'Capri 👩‍💻' o 'Admin (Panel Web) 👤'."""
    clean_p = str(phone).strip()
    name = user_names.get(clean_p, "")
    
    # Si el nombre es el bot, admin o teléfono, buscar el nombre real en mensajes del cliente
    if not name or name in ["Capri 👩‍💻", "Capri 👩‍💻", "Admin (Panel Web) 👤"] or ("Capri" in name or "Capribot" in name) or "Admin (" in name or name == clean_p:
        logs = chat_logs_history.get(clean_p, [])
        for m in reversed(logs):
            sender = m.get("sender", "")
            m_name = m.get("name", "")
            if sender == "client" and m_name and m_name not in ["Capri 👩‍💻", "Capri 👩‍💻", "Admin (Panel Web) 👤"] and ("Capri" not in m_name and "Capribot" not in m_name) and "Admin (" not in m_name and m_name != clean_p:
                name = m_name
                user_names[clean_p] = name
                break
                
        # Si aún no se encuentra, buscar en clientes.json
        if not name or name in ["Capri 👩‍💻", "Capri 👩‍💻", "Admin (Panel Web) 👤"] or ("Capri" in name or "Capribot" in name) or "Admin (" in name or name == clean_p:
            try:
                c_data = get_client_data(clean_p)
                if c_data and c_data.get("name"):
                    name = c_data["name"]
                    user_names[clean_p] = name
            except Exception:
                pass
                
    if not name or name in ["Capri 👩‍💻", "Admin (Panel Web) 👤"] or ("Capri" in name or "Capribot" in name) or "Admin (" in name:
        name = f"Cliente +{clean_p}"
    
    if name and clean_p:
        user_names[clean_p] = name
        
    return name

def load_chat_history():
    global chat_logs_history, user_names, attended_chats, unread_chats, unread_counts, requires_worker_chats, chat_log_counter, alta_demanda_mode, latest_order_summaries
    if os.path.exists(CHAT_HISTORY_FILE):
        try:
            with open(CHAT_HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                chat_logs_history = data.get("chat_logs_history", {})
                user_names.update(data.get("user_names", {}))
                attended_chats = set(data.get("attended_chats", []))
                unread_chats = set(data.get("unread_chats", []))
                unread_counts = data.get("unread_counts", {})
                requires_worker_chats = data.get("requires_worker_chats", {})
                latest_order_summaries.update(data.get("latest_order_summaries", {}))
                for p_key, r_val in list(requires_worker_chats.items()):
                    if isinstance(r_val, str) and "\n" in r_val:
                        requires_worker_chats[p_key] = " - ".join([line.strip() for line in r_val.splitlines() if line.strip()])
                if "alta_demanda_mode" in data:
                    alta_demanda_mode = bool(data.get("alta_demanda_mode", False))
                
                # Sanear nombres de clientes para corregir cualquier 'Capri 👩‍💻' o 'Admin' previo
                for p in list(user_names.keys()):
                    user_names[p] = get_client_display_name(p)
                
                max_id = 0
                # Optimización de Memoria: Extraer base64 a uploads y archivar mensajes > 25
                os.makedirs("uploads", exist_ok=True)
                to_archive = {}
                history_modified = False

                for phone, msgs in list(chat_logs_history.items()):
                    cleaned_msgs = []
                    for m in msgs:
                        if isinstance(m, dict):
                            # Si hay imagen en base64 embebida, guardarla en disco
                            med_url = m.get("media_url")
                            if med_url and isinstance(med_url, str) and med_url.startswith("data:image"):
                                try:
                                    header, b64_data = med_url.split(",", 1)
                                    ext = "png" if "png" in header else "jpg"
                                    m_id = m.get("id", int(datetime.now().timestamp()))
                                    img_fname = f"uploads/client_photo_{phone}_{m_id}.{ext}"
                                    if not os.path.exists(img_fname):
                                        with open(img_fname, "wb") as img_f:
                                            img_f.write(base64.b64decode(b64_data))
                                    m["media_url"] = f"/{img_fname}"
                                    history_modified = True
                                except Exception as err_b64:
                                    logger.error(f"Error extrayendo base64 a archivo: {err_b64}")
                                    m["media_url"] = None
                                    history_modified = True
                            
                            m_id = m.get("id")
                            if isinstance(m_id, int) and m_id > max_id:
                                max_id = m_id
                        cleaned_msgs.append(m)

                    if len(cleaned_msgs) > MAX_ACTIVE_LOGS_PER_CHAT:
                        to_archive[phone] = cleaned_msgs[:-MAX_ACTIVE_LOGS_PER_CHAT]
                        chat_logs_history[phone] = cleaned_msgs[-MAX_ACTIVE_LOGS_PER_CHAT:]
                        history_modified = True
                    else:
                        chat_logs_history[phone] = cleaned_msgs

                if to_archive:
                    archive_old_chat_logs(to_archive)

                if history_modified:
                    save_chat_history()

                chat_log_counter = max_id
                logger.info(f"✅ Historial cargado y optimizado (max 25 msgs/chat en RAM): {len(chat_logs_history)} chats, max_id={max_id}")
        except Exception as e:
            logger.error(f"❌ Error cargando {CHAT_HISTORY_FILE}: {e}")

def save_chat_history():
    try:
        data = {
            "alta_demanda_mode": alta_demanda_mode,
            "chat_logs_history": chat_logs_history,
            "user_names": user_names,
            "attended_chats": list(attended_chats),
            "unread_chats": list(unread_chats),
            "unread_counts": unread_counts,
            "requires_worker_chats": requires_worker_chats,
            "latest_order_summaries": latest_order_summaries
        }
        atomic_json_dump(CHAT_HISTORY_FILE, data)
    except Exception as e:
        logger.error(f"❌ Error guardando {CHAT_HISTORY_FILE}: {e}")

def _clean_session_for_storage(session_msgs):
    """Limpia cadenas base64 pesadas de comprobantes para mantener user_sessions.json ultraligero y rápido."""
    cleaned = []
    for msg in session_msgs:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        content = msg.get("content")
        if isinstance(content, list):
            cleaned_content = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image_url":
                    cleaned_content.append({
                        "type": "text",
                        "text": "[Comprobante/Foto procesada]"
                    })
                else:
                    cleaned_content.append(item)
            cleaned_msg = dict(msg)
            cleaned_msg["content"] = cleaned_content
            cleaned.append(cleaned_msg)
        else:
            cleaned.append(msg)
    return cleaned

def save_user_sessions():
    """Guarda todas las sesiones activas con OpenAI, ubicaciones GPS y estados en user_sessions.json para que jamás se borren al actualizar."""
    try:
        serializable_sessions = {}
        for s_id, msgs in user_sessions.items():
            serializable_sessions[s_id] = _clean_session_for_storage(msgs)

        data = {
            "user_sessions": serializable_sessions,
            "user_gps": user_gps,
            "user_last_activity": user_last_activity,
            "pending_validation_users_wa": list(pending_validation_users_wa),
            "recently_approved_chats": list(recently_approved_chats),
            "waiting_order_query_users": list(waiting_order_query_users)
        }
        atomic_json_dump(SESSIONS_FILE, data)
    except Exception as e:
        logger.error(f"❌ Error guardando sesiones activas en {SESSIONS_FILE}: {e}")

def load_user_sessions():
    """Carga las conversaciones activas, GPS y estados desde user_sessions.json al iniciar el bot para no perder memoria."""
    global user_sessions, user_gps, user_last_activity, pending_validation_users_wa, recently_approved_chats, waiting_order_query_users
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                loaded_sessions = data.get("user_sessions", {})
                for s_id, msgs in loaded_sessions.items():
                    user_sessions[s_id] = msgs
                user_gps.update(data.get("user_gps", {}))
                user_last_activity.update(data.get("user_last_activity", {}))
                pending_validation_users_wa.update(data.get("pending_validation_users_wa", []))
                recently_approved_chats.update(data.get("recently_approved_chats", []))
                waiting_order_query_users.update(data.get("waiting_order_query_users", []))
                logger.info(f"✅ Sesiones activas recuperadas desde {SESSIONS_FILE}: {len(user_sessions)} conversaciones restauradas.")
        except Exception as e:
            logger.error(f"❌ Error cargando {SESSIONS_FILE}: {e}")

def check_pack_amarillo_registered(session_id: str) -> bool:
    """
    Verifica si en este chat ya hubo previamente una conversación de registro o reserva del Pack Amarillo.
    Retorna True si el cliente ya reservó o registró su pack antes de que se agotara el stock.
    """
    session_id = str(session_id).strip()
    
    # 1. Verificar si está en las alertas de asesor humano por reserva de pack amarillo
    reason = str(requires_worker_chats.get(session_id, "")).lower()
    if "pack amarillo" in reason or "promo amarilla" in reason or "reserva pack" in reason:
        return True
        
    # 2. Revisar historial de OpenAI en memoria si existe
    if session_id in user_sessions:
        for msg in user_sessions[session_id]:
            role = msg.get("role")
            content = str(msg.get("content", "")).lower()
            
            # Si se llamó la herramienta de reserva o cálculo con pack amarillo
            if role == "tool":
                name = msg.get("name", "")
                if name == "derivar_reserva_promo_amarilla":
                    return True
                if name == "calcular_total_pedido" and ("pack amarillo" in content or "combo amarillo" in content):
                    return True
            
            # Si el asistente confirmó una reserva o desglose de pack amarillo
            if role == "assistant":
                if ("alerta a nuestro equipo para agendar tu reserva" in content and "amarillo" in content) or \
                   ("reserva del pack amarillo" in content) or \
                   ("reserva del combo amarillo" in content) or \
                   ("desglose de tu pedido" in content and "pack amarillo" in content) or \
                   ("1x pack amarillo" in content) or \
                   ("he enviado la alerta para tu reserva del pack amarillo" in content) or \
                   ("he enviado una alerta a nuestro equipo para coordinar tu reserva del pack amarillo" in content) or \
                   ("registrare el pack amarillo" in content):
                    return True

    # 3. Revisar chat_logs_history (historial persistente de mensajes reales en WhatsApp)
    logs = chat_logs_history.get(session_id, [])
    for m in logs:
        text = str(m.get("text", "")).lower()
        
        # Mensajes enviados por el bot, admin o cliente confirmando reserva/registro
        if ("reserva del pack amarillo" in text) or \
           ("reserva del combo amarillo" in text) or \
           ("solicitud de reserva - pack amarillo" in text) or \
           ("alerta a nuestro equipo para agendar tu reserva" in text and "amarillo" in text) or \
           ("desglose de tu pedido" in text and "pack amarillo" in text) or \
           ("1x pack amarillo" in text) or \
           ("registrare el pack amarillo" in text) or \
           ("he enviado una alerta" in text and "pack amarillo" in text) or \
           ("he enviado la alerta" in text and "pack amarillo" in text):
            return True

    return False

load_chat_history()
load_user_sessions()

# ----------------------------------------------------
# MODO DE AVISO ESPECIAL / CORTE DE ENERGÍA (SOLO HOY)
# ----------------------------------------------------
SPECIAL_NOTICE_DATE = "2026-09-08"
SPECIAL_NOTICE_TEXT = (
    "📢 Aviso importante\n"
    "El día de hoy no podremos brindar atención debido a un corte de energía eléctrica en nuestro local. 🧡\n"
    "Lamentamos mucho los inconvenientes y agradecemos su comprensión. 🙏\n\n"
    "Caprichos Cafetería Artesanal 🧡"
)
SPECIAL_NOTICE_IMAGE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "corte_luz.jpg")
SPECIAL_NOTICE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "special_notice_notified.json")

def load_special_notice_notified() -> set:
    if os.path.exists(SPECIAL_NOTICE_FILE):
        try:
            with open(SPECIAL_NOTICE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("date") == SPECIAL_NOTICE_DATE:
                    return set(data.get("users", []))
        except Exception as e:
            logger.error(f"Error cargando archivo de aviso especial: {e}")
    return set()

def save_special_notice_notified(users: set):
    try:
        with open(SPECIAL_NOTICE_FILE, "w", encoding="utf-8") as f:
            json.dump({"date": SPECIAL_NOTICE_DATE, "users": list(users)}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error guardando archivo de aviso especial: {e}")

special_notice_notified_users = load_special_notice_notified()

def is_special_notice_active() -> bool:
    try:
        tz = pytz.timezone("America/Lima")
        today_str = datetime.now(tz).strftime("%Y-%m-%d")
    except Exception:
        today_str = datetime.now().strftime("%Y-%m-%d")
    return today_str == SPECIAL_NOTICE_DATE

def get_tiempo_estimado_str() -> str:
    return "50 - 60 mnts." if alta_demanda_mode else "30 - 45 mnts."

def get_tiempo_estimado_texto() -> str:
    return "50 a 60 minutos" if alta_demanda_mode else "30 a 45 minutos"

def log_chat_message(phone: str, sender: str, name: str, text: str, media_type: str = None, media_url: str = None, location_url: str = None):
    """Guarda un mensaje en el historial de monitoreo en vivo para el Panel Web y lo persiste en disco."""
    global chat_log_counter
    if not phone or not text:
        return
    phone = str(phone).strip()
    if phone not in chat_logs_history:
        chat_logs_history[phone] = []
    # IMPORTANTE: Solo actualizar el nombre del contacto si el remitente es el CLIENTE
    if sender == "client" and name and name != phone and name not in ["Capri 👩‍💻", "Capri 👩‍💻", "Admin (Panel Web) 👤"] and not str(name).startswith("Admin (") and not str(name).startswith("Capribot"):
        user_names[phone] = name
    chat_log_counter += 1
    lima_tz = pytz.timezone('America/Lima')
    now_str = datetime.now(lima_tz).strftime('%Y-%m-%d %I:%M:%S %p')
    chat_logs_history[phone].append({
        "id": chat_log_counter,
        "sender": sender,  # 'client', 'bot', 'admin'
        "name": name,
        "text": text,
        "media_type": media_type,
        "media_url": media_url,
        "location_url": location_url,
        "timestamp": now_str
    })
    # Mantener en RAM y archivo activo máximo 25 mensajes por chat
    if len(chat_logs_history[phone]) > MAX_ACTIVE_LOGS_PER_CHAT:
        excess_count = len(chat_logs_history[phone]) - MAX_ACTIVE_LOGS_PER_CHAT
        to_archive_msgs = chat_logs_history[phone][:excess_count]
        chat_logs_history[phone] = chat_logs_history[phone][excess_count:]
        archive_old_chat_logs({phone: to_archive_msgs})
    save_chat_history()

def load_dynamic_menu():
    global CURRENT_PROMPT
    logger.info("Cargando la carta de productos desde menu_dinamico.txt...")
    try:
        if os.path.exists("menu_dinamico.txt"):
            with open("menu_dinamico.txt", "r", encoding="utf-8") as f:
                menu_texto = f.read()
        else:
            logger.error("No se encontró menu_dinamico.txt")
            menu_texto = "**(La carta no fue encontrada en menu_dinamico.txt)**"
        
        CURRENT_PROMPT = SYSTEM_PROMPT.replace("{menu_texto}", menu_texto)
        logger.info("¡Carta cargada con éxito en el System Prompt!")
        return True
    except Exception as e:
        logger.error(f"Error al cargar menu_dinamico.txt: {e}")
        return False

load_dynamic_menu()

tools = [
    {
        "type": "function",
        "function": {
            "name": "calcular_total_pedido",
            "description": "Calcula matemáticamente el total del pedido sumando el costo de los productos y el delivery. DEBES usar esto antes de dar el precio total al cliente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Nombre y tamaño/sabor del producto"},
                                "price": {"type": "number", "description": "Precio unitario (ej. 14.50)"},
                                "quantity": {"type": "integer", "description": "Cantidad de unidades pedidas"}
                            },
                            "required": ["name", "price", "quantity"]
                        }
                    },
                    "delivery_cost": {
                        "type": "number",
                        "description": "Costo de delivery (0 si no aplica o no se sabe aún)"
                    }
                },
                "required": ["items", "delivery_cost"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "enviar_foto_producto",
            "description": "Envía una foto o imagen referencial de un producto de la carta al WhatsApp del cliente cuando pregunte por fotos, pida ver cómo es o cómo viene el producto (disponible para waffles, frappés, frozens, sándwiches, postres, cajita caprikids, pack amarillo y termo caprichos).",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "Nombre del producto a mostrar (ej. 'waffle frutos del bosque', 'frappe oreo', 'sandwich especial', 'torta de chocolate', 'caprikids', etc.)"
                    },
                    "caption": {
                        "type": "string",
                        "description": "Texto breve o pie de foto opcional que acompaña la imagen"
                    }
                },
                "required": ["product_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "derivar_reserva_promo_amarilla",
            "description": "Se llama de forma obligatoria cuando el cliente desea reservar, separar, apartar o agendar con anticipación el 'Pack Amarillo' para el lunes 21/09/2026 antes de esa fecha, o pide ser atendido para agendar su promo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "detalle_reserva": {
                        "type": "string",
                        "description": "Detalles que haya mencionado el cliente (ej. sabor de frappé 12oz, cantidad de packs, modalidad entrega, o datos proporcionados)"
                    }
                },
                "required": []
            }
        }
    }
]

# Mapeo de IDs de usuario y último message_id recibido
user_last_wamid = {}
user_clean_wa_ids = {}
whatsapp_media_cache = {}

async def upload_whatsapp_media(file_path: str) -> str:
    """Sube una imagen o documento PDF local a WhatsApp Cloud API y devuelve su media_id (con cache)."""
    if file_path in whatsapp_media_cache:
        return whatsapp_media_cache[file_path]

    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID or not os.path.exists(file_path):
        logger.error(f"No se puede subir media: credenciales no configuradas o archivo {file_path} no existe")
        return None

    url = f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}

    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".jpg", ".jpeg"]:
        mime_type = "image/jpeg"
    elif ext == ".png":
        mime_type = "image/png"
    elif ext == ".pdf":
        mime_type = "application/pdf"
    else:
        mime_type = "application/octet-stream"

    filename = os.path.basename(file_path)

    async with httpx.AsyncClient() as http_client:
        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            files = {
                "file": (filename, file_bytes, mime_type)
            }
            data = {
                "messaging_product": "whatsapp",
                "type": mime_type
            }
            res = await http_client.post(url, headers=headers, data=data, files=files, timeout=25.0)
            if res.status_code == 200:
                media_id = res.json().get("id")
                whatsapp_media_cache[file_path] = media_id
                logger.info(f"📁 Media {file_path} ({mime_type}) subida a WhatsApp con media_id: {media_id}")
                return media_id
            else:
                logger.error(f"Error subiendo media a WhatsApp: {res.status_code} - {res.text}")
                return None
        except Exception as e:
            logger.error(f"Excepción subiendo media a WhatsApp: {e}")
            return None

def parse_meta_error(res_text: str, dest_id: str) -> str:
    """Extrae un mensaje de error claro y comprensible de las respuestas de Meta WhatsApp Cloud API."""
    try:
        data = json.loads(res_text)
        err = data.get("error", {})
        code = err.get("code")
        msg = err.get("message", "")
        details = err.get("error_data", {}).get("details", "")
        full_info = f"{msg} {details}".lower()
        
        if code == 131047 or "24 hours" in full_info or "24 hour" in full_info or "re-engagement" in full_info:
            return "⏰ No se puede enviar el mensaje: Han transcurrido más de 24 horas desde el último mensaje de la clienta (Política estricta de ventana de 24h de Meta). Para responderle, debes escribirle directamente desde el WhatsApp de la tienda."
        elif code in [131009, 100] or "formato" in full_info or "not valid" in full_info:
            return f"📱 No se puede enviar el mensaje: El identificador '{dest_id}' es un ID interno de Meta y no un número celular directo. Por favor escríbele o llámale al número que la clienta brindó en el chat."
        elif code == 131026 or "undeliverable" in full_info:
            return "❌ No se pudo entregar el mensaje: El número de teléfono no está activo en WhatsApp o no puede recibir mensajes."
        else:
            return f"⚠️ WhatsApp Cloud API ({code or 'Error'}): {details or msg or res_text}"
    except Exception:
        return f"⚠️ Error al enviar por WhatsApp: {res_text}"

def build_whatsapp_recipient_payload(to_phone: str) -> tuple[dict, str]:
    """Construye el campo de destino correcto para Meta WhatsApp Cloud API según sea número E.164 o BSUID (PE.xxxx)."""
    raw_dest = str(to_phone).strip().replace("+", "")
    # Si contiene punto o prefijo de país BSUID (ej. PE.1048174911395155, US.12345678)
    if "." in raw_dest or re.match(r'^[A-Za-z]{2}\.', raw_dest):
        return {"recipient_type": "individual", "recipient": raw_dest}, raw_dest
    # Si es un número normal
    clean_number = re.sub(r'^[A-Za-z]{2}\.', '', raw_dest).replace("+", "").strip()
    return {"recipient_type": "individual", "to": clean_number}, clean_number

async def send_whatsapp_image_detailed(to_phone: str, file_path: str, caption: str = "") -> tuple[bool, str]:
    """Envía una imagen a un usuario por WhatsApp usando Meta Cloud API y devuelve (éxito, mensaje/error)."""
    media_id = await upload_whatsapp_media(file_path)
    if not media_id:
        if caption:
            return await send_whatsapp_message_detailed(to_phone, caption)
        return False, "No se pudo procesar o subir la imagen a WhatsApp Cloud API."

    url = f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    recip_dict, dest_id = build_whatsapp_recipient_payload(to_phone)
    wamid = user_last_wamid.get(dest_id) or user_last_wamid.get(to_phone) or user_last_wamid.get(str(to_phone).strip())

    payload = {
        "messaging_product": "whatsapp",
        **recip_dict,
        "type": "image",
        "image": {
            "id": media_id,
            "caption": caption
        }
    }
    if wamid:
        payload["context"] = {"message_id": wamid}

    async with httpx.AsyncClient() as http_client:
        try:
            res = await http_client.post(url, json=payload, headers=headers, timeout=15.0)
            logger.info(f"📤 Imagen enviada a WhatsApp {dest_id}: {res.status_code} - {res.text}")
            
            # Reintento sin context wamid si falló
            if res.status_code >= 400 and wamid:
                payload_no_context = {
                    "messaging_product": "whatsapp",
                    **recip_dict,
                    "type": "image",
                    "image": {
                        "id": media_id,
                        "caption": caption
                    }
                }
                res_retry = await http_client.post(url, json=payload_no_context, headers=headers, timeout=15.0)
                if res_retry.status_code < 400:
                    logger.info(f"📤 Imagen enviada con éxito a {dest_id} tras reintento sin context wamid.")
                    return True, "Imagen enviada con éxito."
            
            if res.status_code < 400:
                return True, "Imagen enviada con éxito."
            else:
                err_msg = parse_meta_error(res.text, dest_id)
                logger.error(f"Error enviando imagen de WhatsApp a {to_phone}: {res.status_code} - {res.text}")
                return False, err_msg
        except Exception as e:
            logger.error(f"Error enviando imagen de WhatsApp a {to_phone}: {e}")
            return False, f"Excepción de conexión al enviar imagen: {str(e)}"

async def send_whatsapp_image(to_phone: str, file_path: str, caption: str = "") -> bool:
    success, _ = await send_whatsapp_image_detailed(to_phone, file_path, caption=caption)
    return success

async def send_whatsapp_document_detailed(to_phone: str, file_path: str, caption: str = "", filename: str = None) -> tuple[bool, str]:
    """Envía un documento PDF por WhatsApp usando Meta Cloud API y devuelve (éxito, mensaje/error)."""
    if not filename:
        filename = os.path.basename(file_path)
    media_id = await upload_whatsapp_media(file_path)
    if not media_id:
        if caption:
            return await send_whatsapp_message_detailed(to_phone, caption)
        return False, "No se pudo subir el documento a WhatsApp Cloud API."

    url = f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    recip_dict, dest_id = build_whatsapp_recipient_payload(to_phone)
    wamid = user_last_wamid.get(dest_id) or user_last_wamid.get(to_phone) or user_last_wamid.get(str(to_phone).strip())

    payload = {
        "messaging_product": "whatsapp",
        **recip_dict,
        "type": "document",
        "document": {
            "id": media_id,
            "caption": caption,
            "filename": filename
        }
    }
    if wamid:
        payload["context"] = {"message_id": wamid}

    async with httpx.AsyncClient() as http_client:
        try:
            res = await http_client.post(url, json=payload, headers=headers, timeout=20.0)
            logger.info(f"📤 Documento PDF enviado a WhatsApp {dest_id}: {res.status_code} - {res.text}")
            
            if res.status_code >= 400 and wamid:
                payload_no_context = {
                    "messaging_product": "whatsapp",
                    **recip_dict,
                    "type": "document",
                    "document": {
                        "id": media_id,
                        "caption": caption,
                        "filename": filename
                    }
                }
                res_retry = await http_client.post(url, json=payload_no_context, headers=headers, timeout=20.0)
                if res_retry.status_code < 400:
                    return True, "Documento enviado con éxito."
            
            if res.status_code < 400:
                return True, "Documento enviado con éxito."
            else:
                err_msg = parse_meta_error(res.text, dest_id)
                logger.error(f"Error enviando documento a {to_phone}: {res.status_code} - {res.text}")
                return False, err_msg
        except Exception as e:
            logger.error(f"Error enviando documento a {to_phone}: {e}")
            return False, f"Excepción de conexión al enviar documento: {str(e)}"

async def send_whatsapp_document(to_phone: str, file_path: str, caption: str = "", filename: str = None) -> bool:
    success, _ = await send_whatsapp_document_detailed(to_phone, file_path, caption=caption, filename=filename)
    return success

async def send_whatsapp_message_detailed(to_phone: str, text: str, reply_to_wamid: str = None) -> tuple[bool, str]:
    """Envía un mensaje de texto a WhatsApp vía Meta Cloud API y devuelve (éxito, mensaje/error)."""
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        logger.error("WHATSAPP_TOKEN o WHATSAPP_PHONE_ID no configurados en .env")
        return False, "Credenciales de WhatsApp Cloud API no configuradas."
        
    url = f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    
    recip_dict, dest_id = build_whatsapp_recipient_payload(to_phone)
    wamid = reply_to_wamid or user_last_wamid.get(dest_id) or user_last_wamid.get(to_phone) or user_last_wamid.get(str(to_phone).strip())
    
    payload = {
        "messaging_product": "whatsapp",
        **recip_dict,
        "type": "text",
        "text": {"preview_url": False, "body": text}
    }
    if wamid:
        payload["context"] = {"message_id": wamid}
        
    async with httpx.AsyncClient() as http_client:
        try:
            res = await http_client.post(url, json=payload, headers=headers, timeout=10.0)
            logger.info(f"📤 Respuesta envío Meta a {dest_id} (wamid context: {bool(wamid)}): {res.status_code} - {res.text}")
            
            # Reintento sin context wamid si falló
            if res.status_code >= 400 and wamid:
                payload_no_context = {
                    "messaging_product": "whatsapp",
                    **recip_dict,
                    "type": "text",
                    "text": {"preview_url": False, "body": text}
                }
                res_retry = await http_client.post(url, json=payload_no_context, headers=headers, timeout=10.0)
                if res_retry.status_code < 400:
                    logger.info(f"📤 Mensaje enviado con éxito a {dest_id} tras reintento sin context wamid.")
                    return True, "Mensaje enviado con éxito."
            
            if res.status_code >= 400:
                err_msg = parse_meta_error(res.text, dest_id)
                logger.error(f"Error enviando WhatsApp a {to_phone}: {res.status_code} - {res.text}")
                return False, err_msg
            return True, "Mensaje enviado con éxito."
        except Exception as e:
            logger.error(f"Excepción al enviar WhatsApp a {to_phone}: {e}")
            return False, f"Excepción de conexión con WhatsApp: {str(e)}"

async def send_whatsapp_message(to_phone: str, text: str, reply_to_wamid: str = None) -> bool:
    success, _ = await send_whatsapp_message_detailed(to_phone, text, reply_to_wamid=reply_to_wamid)
    return success

async def send_whatsapp_interactive_buttons_detailed(to_phone: str, body_text: str, buttons: list[dict], reply_to_wamid: str = None) -> tuple[bool, str]:
    """Envía un mensaje interactivo con botones de respuesta rápida a WhatsApp vía Meta Cloud API."""
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        logger.error("WHATSAPP_TOKEN o WHATSAPP_PHONE_ID no configurados en .env")
        return False, "Credenciales de WhatsApp Cloud API no configuradas."

    url = f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }

    recip_dict, dest_id = build_whatsapp_recipient_payload(to_phone)
    wamid = reply_to_wamid or user_last_wamid.get(dest_id) or user_last_wamid.get(to_phone) or user_last_wamid.get(str(to_phone).strip())

    # Limitar texto de cuerpo a 1024 caracteres (límite de Meta para botones interactivos)
    safe_body = body_text[:1020] if len(body_text) > 1024 else body_text

    formatted_buttons = []
    for btn in buttons[:3]:
        formatted_buttons.append({
            "type": "reply",
            "reply": {
                "id": str(btn["id"])[:256],
                "title": str(btn["title"])[:20]
            }
        })

    payload = {
        "messaging_product": "whatsapp",
        **recip_dict,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": safe_body
            },
            "action": {
                "buttons": formatted_buttons
            }
        }
    }
    if wamid:
        payload["context"] = {"message_id": wamid}

    async with httpx.AsyncClient() as http_client:
        try:
            res = await http_client.post(url, json=payload, headers=headers, timeout=12.0)
            logger.info(f"📤 Envío botones interactivos a {dest_id}: {res.status_code} - {res.text}")
            
            # Reintento sin context wamid si falló
            if res.status_code >= 400 and wamid:
                payload_no_context = {
                    "messaging_product": "whatsapp",
                    **recip_dict,
                    "type": "interactive",
                    "interactive": {
                        "type": "button",
                        "body": {
                            "text": safe_body
                        },
                        "action": {
                            "buttons": formatted_buttons
                        }
                    }
                }
                res_retry = await http_client.post(url, json=payload_no_context, headers=headers, timeout=12.0)
                if res_retry.status_code < 400:
                    logger.info(f"📤 Botones interactivos enviados a {dest_id} tras reintento sin context wamid.")
                    return True, "Botones enviados con éxito."
            
            if res.status_code >= 400:
                err_msg = parse_meta_error(res.text, dest_id)
                logger.error(f"Error enviando botones interactivos a {to_phone}: {res.status_code} - {res.text}")
                return False, err_msg
            return True, "Botones enviados con éxito."
        except Exception as e:
            logger.error(f"Excepción al enviar botones interactivos a {to_phone}: {e}")
            return False, f"Excepción de conexión con WhatsApp: {str(e)}"

async def send_whatsapp_interactive_buttons(to_phone: str, body_text: str, buttons: list[dict], reply_to_wamid: str = None) -> bool:
    success, _ = await send_whatsapp_interactive_buttons_detailed(to_phone, body_text, buttons, reply_to_wamid=reply_to_wamid)
    return success

async def get_whatsapp_media_bytes(media_id: str) -> bytes:
    """Obtiene los bytes de una imagen recibida en WhatsApp usando su media_id."""
    if not WHATSAPP_TOKEN:
        return None
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    async with httpx.AsyncClient() as http_client:
        try:
            # 1. Obtener URL de descarga
            res = await http_client.get(f"https://graph.facebook.com/v20.0/{media_id}", headers=headers, timeout=10.0)
            if res.status_code != 200:
                logger.error(f"Error obteniendo URL de media_id {media_id}: {res.text}")
                return None
            media_url = res.json().get("url")
            if not media_url:
                return None
                
            # 2. Descargar los bytes de la imagen
            res_media = await http_client.get(media_url, headers=headers, timeout=15.0)
            if res_media.status_code == 200:
                return res_media.content
            else:
                logger.error(f"Error descargando media desde URL: {res_media.status_code}")
                return None
        except Exception as e:
            logger.error(f"Excepción descargando media_id {media_id}: {e}")
            return None

async def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    """Transcribe una nota de voz o audio recibido de WhatsApp usando Whisper de OpenAI."""
    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "voice_note.ogg"
        transcription = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="es"
        )
        return transcription.text.strip() if transcription else ""
    except Exception as e:
        logger.error(f"Error transcribiendo audio con Whisper: {e}")
        return ""

# ----------------------------------------------------
# CONTROL DE TIMEOUT DE SESIÓN POR INACTIVIDAD (3 HORAS)
# ----------------------------------------------------
SESSION_TIMEOUT_HOURS = 3  # Reseteo automático tras 3 horas de inactividad
SESSION_TIMEOUT_SECONDS = SESSION_TIMEOUT_HOURS * 3600
user_last_activity = {}

# parse_timestamp_to_epoch definida globalmente arriba

def sanitize_messages_for_openai(messages_list):
    """
    Sanea rigurosamente el historial de mensajes para cumplir las reglas de OpenAI API:
    - Descarta mensajes 'tool' huérfanos sin assistant previo que tenga tool_calls coincidente.
    - Asegura que los assistant messages con tool_calls tengan sus correspondientes tool messages.
    - Si un assistant message tiene tool_calls incompletos o ausentes, se eliminan los tool_calls
      y se preserva su contenido textual para evitar error 400.
    """
    if not messages_list:
        return []

    clean = []
    i = 0
    n = len(messages_list)
    while i < n:
        msg = messages_list[i]
        if not isinstance(msg, dict):
            i += 1
            continue

        role = msg.get("role")

        if role == "tool":
            valid = False
            for prev in reversed(clean):
                if prev.get("role") == "assistant" and prev.get("tool_calls"):
                    prev_ids = [
                        (tc.id if hasattr(tc, 'id') else tc.get('id'))
                        for tc in prev.get("tool_calls", [])
                        if hasattr(tc, 'id') or (isinstance(tc, dict) and tc.get('id'))
                    ]
                    if msg.get("tool_call_id") in prev_ids:
                        valid = True
                    break
                elif prev.get("role") == "tool":
                    continue
                else:
                    break

            if valid:
                clean.append(msg)
            else:
                logger.warning(f"⚠️ OpenAI Sanitize: Descartando mensaje 'tool' huérfano (id={msg.get('tool_call_id')})")
            i += 1

        elif role == "assistant" and msg.get("tool_calls"):
            t_calls = msg.get("tool_calls", [])
            req_ids = [
                (tc.id if hasattr(tc, 'id') else tc.get('id'))
                for tc in t_calls
                if hasattr(tc, 'id') or (isinstance(tc, dict) and tc.get('id'))
            ]

            next_tools = []
            j = i + 1
            while j < n and isinstance(messages_list[j], dict) and messages_list[j].get("role") == "tool":
                next_tools.append(messages_list[j])
                j += 1

            next_tool_ids = {tm.get("tool_call_id") for tm in next_tools}

            if req_ids and all(tid in next_tool_ids for tid in req_ids):
                clean.append(msg)
                for tm in next_tools:
                    if tm.get("tool_call_id") in req_ids:
                        clean.append(tm)
                i = j
            else:
                logger.warning("⚠️ OpenAI Sanitize: Assistant con tool_calls incompletos. Convirtiendo a mensaje normal.")
                text_content = msg.get("content") or "Detalle de orden o consulta procesada."
                clean.append({"role": "assistant", "content": text_content})
                i = j
        else:
            clean.append(msg)
            i += 1

    return clean

# ----------------------------------------------------
# LÓGICA DE INTELIGENCIA ARTIFICIAL (OPENAI)
# ----------------------------------------------------
async def get_ai_response(session_id: str, user_message: str = None, is_photo: bool = False, photo_base64: str = None, hidden_system_message: str = None) -> str:
    """Obtiene la respuesta de ChatGPT manteniendo el contexto de la conversación."""
    now_ts = datetime.now().timestamp()
    
    # Verificar si la sesión expiró por inactividad (más de 3 horas)
    if session_id in user_last_activity:
        prev_act = parse_timestamp_to_epoch(user_last_activity[session_id])
        if prev_act is not None:
            elapsed = now_ts - prev_act
            if elapsed > SESSION_TIMEOUT_SECONDS:
                logger.info(f"⌛ Sesión expirada por inactividad para {session_id} ({elapsed/3600:.1f} horas sin interacción). Reseteando conversación...")
                user_sessions.pop(session_id, None)
                # NOTA: NO borrar user_gps para recordar permanentemente la ubicación de entrega del cliente
                pending_validation_users_wa.discard(session_id)

    user_last_activity[session_id] = now_ts

    lima_tz = pytz.timezone('America/Lima')
    now = datetime.now(lima_tz)
    en_horario = 14 <= now.hour < 22
    hora_str = now.strftime('%I:%M %p')
    
    contexto_horario = f"HORA ACTUAL EN LIMA: {hora_str}. "
    if en_horario:
        contexto_horario += "DENTRO DEL HORARIO DE ATENCIÓN DE COCINA Y TIENDA (2:00 PM - 10:00 PM)."
    else:
        contexto_horario += (
            "HORARIO DE PREPARACIÓN/DESPACHO: Cocina y tienda atienden de 2:00 PM a 10:00 PM (la recepción de pedidos por WhatsApp es 24h). "
            "REGLA CRÍTICA DE HORARIOS: ESTÁ TERMINANTEMENTE PROHIBIDO enviar o repetir el horario de atención en cada mensaje. "
            "SOLO debes mencionar el horario si el cliente pregunta explícitamente por él (ej. '¿a qué hora atienden?', '¿están abiertos?'), "
            "o al momento de confirmar un pedido tomado fuera de hora para aclararle amablemente que su preparación y despacho iniciará a las 2:00 PM."
        )

    if session_id not in user_sessions:
        # Recuperar mensajes previos desde chat_logs_history para garantizar que NUNCA se borre el hilo de conversación
        recent_logs = chat_logs_history.get(session_id, [])
        reconstructed_msgs = []
        if recent_logs:
            for log_m in recent_logs[-25:]:
                s_text = str(log_m.get("text", "")).strip()
                if not s_text:
                    continue
                s_role = log_m.get("sender")
                if s_role == "client":
                    reconstructed_msgs.append({"role": "user", "content": s_text})
                elif s_role in ("bot", "admin"):
                    reconstructed_msgs.append({"role": "assistant", "content": s_text})

        sys_msgs = [
            {"role": "system", "content": CURRENT_PROMPT},
            {"role": "system", "content": contexto_horario}
        ]
        client_info = get_client_data(session_id)
        if client_info and client_info.get("nombre") and client_info.get("nombre") != "Cliente Caprichos":
            c_name = client_info["nombre"]
            c_cel = client_info.get("celular", session_id)
            c_pedidos = client_info.get("total_pedidos_aprobados", 0)
            contexto_cliente = (
                f"DATOS DE MEMORIA DEL CLIENTE REGISTRADO: Nombre: {c_name}, Celular: {c_cel}, Pedidos Aprobados Anteriores: {c_pedidos}. "
                f"ESTE CLIENTE YA ES FRECUENTE Y ESTÁ REGISTRADO. Si ya cuenta con Nombre y Apellido completos, no es necesario pedirle su nombre o celular de nuevo al momento de registrar el pedido. "
                f"Al ser su PRIMER mensaje en esta sesión, salúdalo amablemente por su nombre presentándote como Capribot ('¡Hola, {c_name}! Te habla Capri 👋👩‍💻') "
                f"y envíale la invitación oficial a la página web tal como lo indica la regla de bienvenida inicial. "
                f"ESTÁ PROHIBIDO decir 'en el mensaje de arriba 👆' en el primer mensaje de la sesión."
            )
            sys_msgs.append({"role": "system", "content": contexto_cliente})

        user_sessions[session_id] = sys_msgs + reconstructed_msgs
        if reconstructed_msgs:
            logger.info(f"🔄 Sesión reconstruida desde chat_logs_history para {session_id} con {len(reconstructed_msgs)} mensajes previos.")

    # Limpiar cualquier mensaje de sistema viejo acumulado en el historial conversacional
    user_sessions[session_id] = [
        msg for msg in user_sessions[session_id]
        if msg.get("role") != "system"
    ]
    # Limitar historial de conversación a los últimos 26 turnos para preservar nitidez
    if len(user_sessions[session_id]) > 26:
        user_sessions[session_id] = user_sessions[session_id][-26:]

    has_previous_assistant_msg = any(msg.get("role") == "assistant" for msg in user_sessions[session_id])

    # Construir cabecera limpia y consolidada del sistema
    sys_msgs = [
        {"role": "system", "content": CURRENT_PROMPT},
        {"role": "system", "content": contexto_horario}
    ]

    client_info = get_client_data(session_id)
    if client_info and client_info.get("nombre") and client_info.get("nombre") not in ["Cliente Caprichos", "", "[Nombre y Apellido]"]:
        c_name = client_info["nombre"]
        c_cel = client_info.get("celular", session_id)
        c_pedidos = client_info.get("total_pedidos_aprobados", 0)
        sys_msgs.append({
            "role": "system",
            "content": (
                f"DATOS DEL CLIENTE REGISTRADO: Nombre: {c_name}, Celular: {c_cel}, Pedidos Anteriores: {c_pedidos}. "
                f"Este cliente ya está registrado. Si ya tenemos su nombre y celular completos, confirma amablemente y no vuelvas a pedirlos."
            )
        })

    # Reutilización inteligente de ubicación GPS guardada
    reg_gps = user_gps.get(session_id)
    if not reg_gps and client_info and client_info.get("ultima_ubicacion"):
        reg_gps = client_info["ultima_ubicacion"]
        user_gps[session_id] = reg_gps

    if reg_gps and isinstance(reg_gps, dict) and "lat" in reg_gps and "lon" in reg_gps:
        r_lat, r_lon = reg_gps["lat"], reg_gps["lon"]
        maps_link = f"https://www.google.com/maps?q={r_lat},{r_lon}"
        costo_est = reg_gps.get("costo")
        if costo_est is None or costo_est == -1:
            costo_est = calculate_delivery_cost(r_lat, r_lon)
            if costo_est is not None and costo_est != -1:
                costo_est = get_client_delivery_cost(session_id, costo_est)
                reg_gps["costo"] = costo_est
        costo_txt = f"S/ {costo_est:.2f}" if costo_est and costo_est != -1 else "S/ 0.00"
        sys_msgs.append({
            "role": "system",
            "content": (
                f"UBICACIÓN ANTERIOR REGISTRADA DEL CLIENTE: El cliente YA cuenta con una ubicación GPS registrada: {maps_link} "
                f"(Costo de delivery cotizado: {costo_txt}).\n"
                f"REGLA CRÍTICA DE UBICACIÓN PREVIA: Si el pedido es para Delivery, ESTÁ TERMINANTEMENTE PROHIBIDO pedirle la ubicación GPS de nuevo desde cero.\n"
                f"En su lugar, debes pedirle que confirme si se enviará a esa misma ubicación anterior: "
                f"'¿Confirmas que tu pedido se enviará a tu misma ubicación anterior 📍 ({maps_link}) o a una dirección distinta? 🛵'.\n"
                f"Si el cliente confirma (o dice 'sí', 'a esa misma', 'la misma', 'envíamelo rápido', etc.), utiliza directamente ese costo de delivery ({costo_txt}) "
                f"para llamar a `calcular_total_pedido` y presentar el desglose final total."
            )
        })

    sys_msgs.append({
        "role": "system",
        "content": (
            "REGLAS CRÍTICAS DE NEGOCIO Y VOCABULARIO:\n"
            "1. 'Cancelo con [monto]' (ej. 'cancelo con 100 soles enviamelo rapido', 'cancelo con 50', 'cancelo en efectivo'): En el Perú 'cancelar' significa PAGAR. "
            "El cliente pagará en EFECTIVO con dicho billete y solicita que le lleves su vuelto. ESTÁ TERMINANTEMENTE PROHIBIDO interpretar esto como anular o cancelar el pedido.\n"
            "2. VERIFICACIÓN PREVIA AL COBRO: SIEMPRE antes de cobrar o pedir comprobante de pago, verifica si es Delivery o Recojo/Salón. "
            "Si es Delivery, cotiza el costo con precisión (o confirma ubicación registrada), envía el resumen total y espera que el cliente CONFIRME ('¿Todo conforme con su pedido para proceder con el pago?'). "
            "Una vez confirmado, recién gestiona el cobro (voucher Yape/Plin, vuelto para efectivo, o POS para tarjeta)."
        )
    })

    if has_previous_assistant_msg:
        sys_msgs.append({
            "role": "system",
            "content": (
                "REGLA CRÍTICA: Ya iniciaste esta conversación previamente. "
                "ESTÁ ABSOLUTAMENTE PROHIBIDO volver a enviar el enlace web inicial ni repetir el mensaje de bienvenida ni soltar el horario. "
                "Mantén el hilo de la orden acumulando los productos que el cliente solicita."
            )
        })

    if alta_demanda_mode:
        sys_msgs.append({
            "role": "system",
            "content": "MODO ALTA DEMANDA ACTIVO 🔥: Si el cliente consulta sobre el tiempo de entrega o llegada del pedido, informa que el tiempo estimado actualmente es de 50 a 60 minutos debido a la alta demanda de delivery."
        })

    ya_tiene_registro_pack = check_pack_amarillo_registered(session_id)
    if not ya_tiene_registro_pack:
        sys_msgs.append({
            "role": "system",
            "content": "PROMOCIÓN PACK AMARILLO: El Pack Amarillo se encuentra actualmente agotado por alta demanda. Ofrecer la carta regular si preguntan por él."
        })

    if hidden_system_message:
        sys_msgs.append({"role": "system", "content": hidden_system_message})
    
    if is_photo and photo_base64:
        user_text = user_message if user_message else "El usuario envió esta imagen."
        user_sessions[session_id].append({
            "role": "user",
            "content": [
                {"type": "text", "text": (
                    f"{user_text}\n\n"
                    "INSTRUCCIÓN OBLIGATORIA PARA ANÁLISIS DE IMÁGENES:\n"
                    "Analiza la imagen adjunta con atención:\n"
                    "1. SI ES UN COMPROBANTE DE PAGO (Yape, Plin, BCP, Interbank, BBVA, transferencia o depósito):\n"
                    "   - Lee y extrae explícitamente: MONTO (S/ ...), NÚMERO / CÓDIGO DE OPERACIÓN y FECHA/HORA de la transacción.\n"
                    "   - Tu respuesta al cliente DEBE SER EXACTAMENTE esta plantilla formal de recepción (sin inventar aprobaciones):\n"
                    "     '¡Pedido registrado! 📝 Hemos recibido su comprobante por S/ {monto} (Op. {num_operacion}). Estamos enviando su orden al área encargada para su validación. Denos un momento por favor ⏳'\n"
                    "   - REGLA DE ORO ESTRICTA: ESTÁ TERMINANTEMENTE PROHIBIDO decir 'tu pedido está en proceso', 'haremos todo lo posible para que llegue rápido' o prometer tiempos de entrega (como 30 a 45 min) tú solo. La confirmación del pedido y el tiempo oficial de entrega son EXCLUSIVOS del Administrador al aprobar desde Telegram.\n"
                    "2. SI ES UNA CAPTURA DE PANTALLA DE LA CARTA / MENÚ:\n"
                    "   - Identifica qué producto es y consúltale amablemente el tamaño/sabor (mostrando siempre los precios de cada tamaño) para añadirlo al carrito."
                )},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{photo_base64}",
                    },
                },
            ],
        })
    elif user_message:
        user_sessions[session_id].append({"role": "user", "content": user_message})

    # El payload enviado a OpenAI es la cabecera del sistema consolidada + el historial conversacional
    user_sessions[session_id] = sanitize_messages_for_openai(user_sessions[session_id])
    messages_payload = sanitize_messages_for_openai(sys_msgs + user_sessions[session_id])

    try:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages_payload,
            temperature=0.1,
            tools=tools,
            tool_choice="auto"
        )
        message = response.choices[0].message
        
        if message.tool_calls:
            user_sessions[session_id].append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                    } for tc in message.tool_calls
                ]
            })
            
            for tool_call in message.tool_calls:
                try:
                    if tool_call.function.name == "calcular_total_pedido":
                        args = json.loads(tool_call.function.arguments)
                        items = args.get("items", [])
                        delivery_cost = float(args.get("delivery_cost", 0) or 0)
                        
                        # Validar si intentan agregar Pack Amarillo cuando ya está agotado y no tenía registro previo
                        if not check_pack_amarillo_registered(session_id):
                            tiene_pack_amarillo = any("amarillo" in str(it.get("name", "")).lower() for it in items)
                            if tiene_pack_amarillo:
                                tool_content = (
                                    "Error: El Pack Amarillo se encuentra COMPLETAMENTE AGOTADO por alta demanda. "
                                    "No es posible añadirlo al pedido. Por favor informa amablemente al cliente que el Pack Amarillo ya se agotó y ofrécele las deliciosas opciones de nuestra carta regular."
                                )
                                user_sessions[session_id].append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "name": tool_call.function.name,
                                    "content": tool_content
                                })
                                continue

                        subtotal_productos = 0
                        breakdown = ""
                        for item in items:
                            subtotal = item['price'] * item['quantity']
                            subtotal_productos += subtotal
                            breakdown += f"- {item['quantity']}x {item['name']} (S/ {item['price']} c/u) = S/ {subtotal:.2f}\n"
                        
                        # Regla: Todos los pedidos en productos mayores a S/ 70 tienen delivery GRATIS
                        if subtotal_productos > 70:
                            if delivery_cost > 0:
                                breakdown += f"- Delivery = S/ 0.00 (¡GRATIS por compra mayor a S/ 70! 🎉)\n"
                            delivery_cost = 0.0
                        elif delivery_cost > 0:
                            breakdown += f"- Delivery = S/ {delivery_cost:.2f}\n"
                        
                        total = subtotal_productos + delivery_cost
                        breakdown += f"\nTotal exacto a pagar: S/ {total:.2f}\n(Este es el cálculo del sistema, úsalo para presentar el desglose al cliente y continuar con el cobro)."
                        
                        user_sessions[session_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": breakdown
                        })
                    elif tool_call.function.name == "enviar_foto_producto":
                        args = json.loads(tool_call.function.arguments)
                        p_name = str(args.get("product_name", "")).strip()
                        caption = args.get("caption", "")
                        photo_sent = False
                        
                        norm_p = normalize_text(p_name)
                        if any(k in norm_p for k in ["carta", "menu", "carta completa", "fotos carta", "imagenes carta"]):
                            b_path = os.path.join("assets", "CARTA_BEBIDAS.png")
                            s_path = os.path.join("assets", "CARTA_SALADOS.png")
                            if os.path.exists(b_path):
                                await send_whatsapp_image(session_id, b_path, caption="🍹 Carta de Bebidas y Frappés")
                                log_chat_message(session_id, "bot", "Capri 👩‍💻", "[Foto enviada: Carta Bebidas]", media_type="image", media_url="/assets/CARTA_BEBIDAS.png")
                                photo_sent = True
                            if os.path.exists(s_path):
                                await send_whatsapp_image(session_id, s_path, caption="🍔 Carta de Salados, Waffles y Postres")
                                log_chat_message(session_id, "bot", "Capri 👩‍💻", "[Foto enviada: Carta Salados]", media_type="image", media_url="/assets/CARTA_SALADOS.png")
                                photo_sent = True
                        else:
                            img_path = find_product_image(p_name)
                            if img_path and os.path.exists(img_path):
                                photo_sent = await send_whatsapp_image(session_id, img_path, caption=caption)
                                file_basename = os.path.basename(img_path)
                                log_chat_message(session_id, "bot", "Capri 👩‍💻", caption or f"[Foto enviada: {p_name}]", media_type="image", media_url=f"/assets/{file_basename}")
                                photo_sent = True
                            
                        if photo_sent:
                            tool_content = f"Fotos referenciales de '{p_name}' enviadas exitosamente al WhatsApp del cliente."
                        else:
                            tool_content = f"No se encontró una foto disponible para '{p_name}' o hubo un problema al enviarla."
                            
                        user_sessions[session_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": tool_content
                        })
                    elif tool_call.function.name == "derivar_reserva_promo_amarilla":
                        if not check_pack_amarillo_registered(session_id):
                            tool_content = (
                                "El Pack Amarillo se encuentra COMPLETAMENTE AGOTADO por alta demanda. "
                                "No es posible registrar nuevas reservas ni pedidos. "
                                "Por favor informa amablemente al cliente que el Pack Amarillo ya está agotado y ofrécele productos de nuestra carta regular."
                            )
                            user_sessions[session_id].append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "name": tool_call.function.name,
                                "content": tool_content
                            })
                            continue

                        args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                        detalle = str(args.get("detalle_reserva", "")).strip()
                        requires_worker_chats[session_id] = "Reserva Pack Amarillo (21/09/2026)"
                        c_name = user_names.get(session_id, session_id)
                        
                        # Alerta a administradores / cocina por WhatsApp
                        asyncio.create_task(send_admin_whatsapp_notification(
                            f"💛🌻 *[SOLICITUD DE RESERVA - PACK AMARILLO (21/09)]* 🌻💛\n\n"
                            f"👤 *Cliente:* {c_name} ({session_id})\n"
                            f"📝 *Detalle:* {detalle or 'Cliente desea reservar/agendar Pack Amarillo'}\n\n"
                            f"📱 *Abrir chat:* https://wa.me/{session_id}\n\n"
                            f"⚠️ El cliente solicita reservar su Pack Amarillo para el 21/09/2026. Por favor coordinar por chat para agendarlo."
                        ))
                        
                        tool_content = (
                            "Alerta enviada exitosamente al equipo de atención y panel web. "
                            "Informa al cliente amablemente que la alerta ha sido enviada a nuestro equipo y que en breves momentos un asesor se comunicará por este mismo chat para tomar sus datos y coordinar todos los detalles de su reserva del Pack Amarillo para este lunes 21/09."
                        )
                        user_sessions[session_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": tool_content
                        })
                    else:
                        user_sessions[session_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": "Error: Función desconocida."
                        })
                except Exception as inner_e:
                    logger.error(f"Error procesando tool_call {tool_call.id}: {inner_e}")
                    user_sessions[session_id].append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_call.function.name,
                        "content": "Error interno procesando los argumentos."
                    })
            
            response2 = await client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=sanitize_messages_for_openai(sys_msgs + user_sessions[session_id]),
                temperature=0.1
            )
            ai_reply = response2.choices[0].message.content
        else:
            ai_reply = message.content

        # Filtro de seguridad: Evitar repetición accidental del enlace a la web si ya se envió antes
        if has_previous_assistant_msg and "https://caprichos.restaurant.pe" in ai_reply:
            logger.warning(f"⚠️ El bot intentó repetir el enlace web para {session_id}. Sanitizando respuesta...")
            ai_reply = re.sub(r'https?://caprichos\.restaurant\.pe[^\s]*', 'https://wa.me/c/51977503006', ai_reply)
            ai_reply = re.sub(r'Le invitamos a realizar su pedido a través de nuestra página web[^\n]*\n?', '', ai_reply, flags=re.IGNORECASE)
            if not ai_reply.strip():
                ai_reply = (
                    "La carta web está en el mensaje de arriba 👆, pero si gustas con mucho gusto puedo tomarte el pedido directamente por aquí 🥰.\n\n"
                    "Aquí también puedes observar nuestra carta digital de WhatsApp 👉 https://wa.me/c/51977503006 📋✨\n\n"
                    "Cuéntame, ¿qué se te antoja o qué te gustaría pedir hoy? 🍹🍔"
                )

        user_sessions[session_id].append({"role": "assistant", "content": ai_reply})
        save_user_sessions()
        return ai_reply
    except Exception as e:
        logger.error(f"Error en OpenAI API para {session_id}: {e}")
        err_str = str(e).lower()
        if any(w in err_str for w in ["429", "insufficient_quota", "credit_balance_exhausted", "quota"]):
            logger.critical("🚨 SALDO DE OPENAI AGOTADO (ERROR 429).")
            requires_worker_chats[session_id] = "Asistencia humana requerida (Saldo agotado OpenAI)"
            pending_validation_users_wa.add(session_id)
            asyncio.create_task(send_admin_whatsapp_notification(
                "⚠️ *ALERTA CRÍTICA CAPRICHOS BOT:*\nEl saldo de OpenAI API se ha agotado (Error 429). Por favor recargar créditos en OpenAI Platform. El bot está derivando a asesor humano."
            ))
            return "¡Hola! En este momento estamos atendiendo con un asesor humano 👩‍🍳. Por favor déjanos tu consulta o pedido y te responderemos a la brevedad posible 🥰."

        # Recuperación inteligente ante error 400 u orfandad de herramientas en OpenAI
        try:
            logger.warning(f"🔄 Reintentando con contexto limpio para {session_id} tras error: {e}")
            fb_payload = [
                {"role": "system", "content": CURRENT_PROMPT},
                {"role": "user", "content": user_message or "Hola"}
            ]
            fb_resp = await client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=fb_payload,
                temperature=0.1
            )
            fb_text = fb_resp.choices[0].message.content
            if fb_text:
                user_sessions[session_id] = [
                    {"role": "user", "content": user_message or "Hola"},
                    {"role": "assistant", "content": fb_text}
                ]
                save_user_sessions()
                logger.info(f"✅ Recuperación automática exitosa para {session_id}.")
                return fb_text
        except Exception as fb_err:
            logger.error(f"Error en fallback de OpenAI para {session_id}: {fb_err}")

        requires_worker_chats[session_id] = "Asistencia humana requerida (Error o límite de IA)"
        pending_validation_users_wa.add(session_id)
        return "¡Hola! En este momento estamos consultando con nuestro equipo. Por favor déjanos tu consulta o pedido y te responderemos en breve 🙏."

async def generate_kitchen_ticket(session_id: str, wa_name: str) -> str:
    """Genera el ticket final de cocina desde el contexto del usuario en WhatsApp."""
    gps_info = ""
    if session_id in user_gps:
        lat = user_gps[session_id]['lat']
        lon = user_gps[session_id]['lon']
        maps_url = f"https://www.google.com/maps?q={lat},{lon}"
        gps_info = f"Ubicación GPS: {maps_url}"
    else:
        gps_info = "Atención en Tienda (Recojo) / Consumo en Salón"

    prompt_ticket = f"""
Basado en toda la conversación anterior, genera el ticket de cocina EXACTAMENTE con este formato.
Extrae el Nombre, Apellido y Número de Celular que el cliente proporcionó en la conversación. Si no los dio explícitamente, usa los datos de su ficha registrada o nombre de WhatsApp: {wa_name} ({session_id}).

[Nombre y Apellido]
[Número de Celular]
Modalidad: [Delivery / Recojo en Tienda / Consumo en el Local]
Ubicacion: [{gps_info}]
Pedido:
- [Cant]x [Producto] [Personalizaciones si las hay]
Total: [Monto total cobrado]
Forma de pago: [Yape/Plin/Transferencia/Efectivo (si es efectivo, pon con cuánto paga)/Tarjeta (POS)]
N° de Operación: [Extrae el N°/Código de operación que figura en la imagen del comprobante de Yape/Plin si se envió, o "N/A si es efectivo/POS"]
Fecha/Hora del Pago: [Extrae la fecha y hora exacta que figura en la foto del comprobante si se envió, o "N/A"]

IMPORTANTE: NO incluyas número de pedido (#Pedido). NO dejes corchetes ni placeholders genéricos. Escribe directamente los datos reales.
NO escribas nada más que el ticket.
"""
    if session_id not in user_sessions:
        return f"Pedido de WhatsApp: {wa_name} ({session_id})"
        
    temp_messages = sanitize_messages_for_openai(user_sessions[session_id].copy())
    temp_messages.append({"role": "user", "content": prompt_ticket})
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=temp_messages,
            temperature=0.1,
        )
        raw_ticket = response.choices[0].message.content.strip()
        raw_ticket = re.sub(r"^#?pedido\s*\d*\s*\n?", "", raw_ticket, flags=re.IGNORECASE).strip()
        if session_id in user_gps:
            lat = user_gps[session_id]['lat']
            lon = user_gps[session_id]['lon']
            maps_url = f"https://www.google.com/maps?q={lat},{lon}"
            raw_ticket = re.sub(r"Ubicaci[oó]n:.*", f"Ubicación (GPS): {maps_url}", raw_ticket, flags=re.IGNORECASE)
        else:
            is_recojo_local = any(k in raw_ticket.lower() for k in ["recojo", "recoger", "tienda", "local", "salon", "salón", "llevar"])
            if is_recojo_local:
                if any(k in raw_ticket.lower() for k in ["local", "salón", "salon", "mesa"]):
                    raw_ticket = re.sub(r"Ubicaci[oó]n:.*", "Ubicación: Consumo en Salón/Local", raw_ticket, flags=re.IGNORECASE)
                else:
                    raw_ticket = re.sub(r"Ubicaci[oó]n:.*", "Ubicación: Atención en Tienda (Recojo)", raw_ticket, flags=re.IGNORECASE)

        # Intentar extraer nombre y celular del ticket para guardar en memoria del cliente
        try:
            lines = [line.strip() for line in raw_ticket.split("\n") if line.strip()]
            if len(lines) >= 2:
                extracted_name = lines[0]
                extracted_cel = lines[1]
                if extracted_name and not any(extracted_name.lower().startswith(k) for k in ["modalidad", "ubicaci", "pedido", "total"]):
                    save_client_info(session_id, name=extracted_name, cel=extracted_cel)
        except Exception as save_err:
            logger.error(f"Error registrando cliente en clientes.json: {save_err}")

        return raw_ticket
    except Exception as e:
        logger.error(f"Error generando ticket: {e}")
        return f"Error generando ticket para {wa_name} ({session_id})"


# ----------------------------------------------------
# NOTIFICACIONES Y BOTONES AL WHATSAPP DE COCINA / ADMIN
# ----------------------------------------------------

async def send_admin_whatsapp_notification(text: str, photo_bytes: bytes = None):
    """Envía notificaciones generales o alertas críticas a los números de WhatsApp del Administrador/Cocina."""
    for admin_phone in ADMIN_WHATSAPP_NUMBERS:
        try:
            if photo_bytes:
                os.makedirs("uploads", exist_ok=True)
                temp_filename = f"uploads/voucher_admin_{int(datetime.now().timestamp())}.jpg"
                with open(temp_filename, "wb") as f:
                    f.write(photo_bytes)
                await send_whatsapp_image(admin_phone, temp_filename, caption=text)
            else:
                await send_whatsapp_message(admin_phone, text)
        except Exception as e:
            logger.error(f"Error enviando notificación WhatsApp a admin {admin_phone}: {e}")

async def send_admin_order_notification_with_buttons(session_id: str, wa_name: str, ticket_text: str, photo_bytes: bytes = None):
    """Envía el ticket de nuevo pedido al WhatsApp de Cocina/Admin con 2 botones de Aprobación/Rechazo."""
    p_formatted = format_peru_phone(session_id)
    p_national = get_national_peru_phone(session_id)
    full_caption = (
        f"🚨 *[NUEVO PEDIDO REGISTRADO]* 🚨\n\n"
        f"{ticket_text}\n\n"
        f"👤 *Cliente:* {wa_name}\n"
        f"📱 *Celular:* {p_formatted} (Búsqueda rápida: *{p_national}*)\n"
        f"💬 *Chat Directo:* https://wa.me/{session_id}"
    )

    buttons = [
        {"id": f"approve_{session_id}", "title": "✅ Aprobar Pedido"},
        {"id": f"reject_{session_id}", "title": "❌ Rechazar"}
    ]

    for admin_phone in ADMIN_WHATSAPP_NUMBERS:
        try:
            if photo_bytes:
                os.makedirs("uploads", exist_ok=True)
                temp_filename = f"uploads/voucher_admin_{int(datetime.now().timestamp())}.jpg"
                with open(temp_filename, "wb") as f:
                    f.write(photo_bytes)
                await send_whatsapp_image(admin_phone, temp_filename, caption=f"🧾 *Comprobante de Pago* - {wa_name} ({session_id})")

            # Enviar mensaje interactivo con los 2 botones
            success, err = await send_whatsapp_interactive_buttons_detailed(admin_phone, full_caption, buttons)
            if not success:
                logger.warning(f"No se pudieron enviar botones a {admin_phone} ({err}), enviando como texto simple...")
                await send_whatsapp_message(admin_phone, full_caption)

            # Si es delivery y tiene ubicación GPS, enviar link de mapa directo a cocina
            if session_id in user_gps:
                lat = user_gps[session_id]['lat']
                lon = user_gps[session_id]['lon']
                maps_url = f"https://www.google.com/maps?q={lat},{lon}"
                is_recojo = any(k in ticket_text.lower() for k in ["recojo", "tienda", "local", "salon", "salón"])
                if not is_recojo:
                    await send_whatsapp_message(admin_phone, f"📍 *Ubicación GPS de Entrega:*\n{maps_url}")
        except Exception as e:
            logger.error(f"Error enviando orden con botones a admin {admin_phone}: {e}")

async def handle_admin_order_action_wa(admin_phone: str, action_id: str, btn_title: str):
    """Procesa la pulsación de los botones ✅ Aprobar / ❌ Rechazar desde el WhatsApp de Cocina/Admin."""
    if action_id.startswith("approve_"):
        customer_phone = action_id.replace("approve_", "").strip()
        action = "approve"
    elif action_id.startswith("reject_"):
        customer_phone = action_id.replace("reject_", "").strip()
        action = "reject"
    else:
        return

    c_name = user_names.get(customer_phone, f"Cliente +{customer_phone}")

    if action == "approve":
        total_pedidos = increment_approved_order_count(customer_phone)
        pending_validation_users_wa.discard(customer_phone)
        requires_worker_chats.pop(customer_phone, None)
        recently_approved_chats.add(customer_phone)

        # Determinar si es recojo en tienda o delivery
        history = user_sessions.get(customer_phone, [])
        history_text = " ".join([str(m.get("content", "")) for m in history]).lower()
        is_recojo_o_local = any(k in history_text for k in ["recojo en tienda", "para recoger", "recojo", "consumo en el local", "en tienda", "para llevar", "en el local", "salon", "salón"])

        if is_recojo_o_local and customer_phone not in user_gps:
            confirm_msg = "Gracias 🥰\n\nSu pedido ha sido aceptado con éxito 🎉. Le avisaremos por aquí cuando su pedido esté listo para su recojo 🛍️✨. ¡Muchas gracias por su preferencia! 🙌🏻"
        else:
            tiempo_str = get_tiempo_estimado_str()
            confirm_msg = f"Gracias 🥰 \n\nEn un plazo aprox a {tiempo_str} estará llegando su pedido 🙌🏻, por favor este atent@ que el Delivery le anticipará su llegada vía WhatsApp o llamada✌️🤗"

        # 1. Enviar mensaje de confirmación oficial al cliente
        await send_whatsapp_message(customer_phone, confirm_msg)
        log_chat_message(customer_phone, "bot", "Capri 👩‍💻", confirm_msg)

        # 2. Enviar confirmación al Administrador / Cocina que pulsó el botón
        admin_reply = (
            f"✅ *PEDIDO APROBADO CON ÉXITO*\n\n"
            f"👤 *Cliente:* {c_name} (+{customer_phone})\n"
            f"📊 *Historial:* Pedido N° {total_pedidos} de este cliente.\n"
            f"📨 *Notificación enviada al cliente:* '{confirm_msg}'"
        )
        await send_whatsapp_message(admin_phone, admin_reply)
        logger.info(f"✅ Pedido de {customer_phone} APROBADO desde WhatsApp por admin {admin_phone}")

    elif action == "reject":
        pending_validation_users_wa.discard(customer_phone)
        requires_worker_chats.pop(customer_phone, None)

        reject_msg = "Hola, lamentablemente hemos encontrado un problema con la validación de su pago (el monto no coincide o no se pudo verificar). Por favor, revise e intente enviar el comprobante correcto nuevamente 🙏."

        # 1. Enviar aviso de rechazo al cliente
        await send_whatsapp_message(customer_phone, reject_msg)
        log_chat_message(customer_phone, "bot", "Capri 👩‍💻", reject_msg)

        # 2. Enviar confirmación al Administrador / Cocina
        admin_reply = (
            f"❌ *PEDIDO RECHAZADO*\n\n"
            f"👤 *Cliente:* {c_name} (+{customer_phone})\n"
            f"📨 Se le notificó al cliente para que reenvíe el comprobante correcto."
        )
        await send_whatsapp_message(admin_phone, admin_reply)
        logger.info(f"❌ Pedido de {customer_phone} RECHAZADO desde WhatsApp por admin {admin_phone}")

def extract_name_and_phone(text: str, default_phone: str = "") -> tuple[str, str]:
    """Extrae el nombre del cliente y su número de celular peruano de su mensaje de registro."""
    text_clean = text.strip()
    
    # 1. Buscar número de celular peruano de 9 dígitos que empiece con 9
    phone_match = re.search(r'\b(9\d{8})\b', text_clean)
    if phone_match:
        cel = phone_match.group(1)
    else:
        clean_d = re.sub(r'\D', '', default_phone)
        cel = clean_d[2:] if clean_d.startswith("51") and len(clean_d) == 11 else clean_d
        
    # 2. Remover los números para quedarnos con el nombre
    name_text = re.sub(r'\b\d{6,12}\b', '', text_clean)
    # Limpiar palabras comunes de introducción
    name_text = re.sub(r'(?i)\b(mi|nombre|es|me|llamo|soy|y|celular|numero|número|cel|tel|telefono|teléfono|por|favor)\b', '', name_text)
    name_text = re.sub(r'[^\w\sáéíóúÁÉÍÓÚñÑ]', ' ', name_text).strip()
    name_text = re.sub(r'\s+', ' ', name_text).strip()
    
    if name_text and len(name_text) >= 2:
        name = " ".join([w.capitalize() for w in name_text.split()])
    else:
        name = "Cliente"
        
    return name, cel

def find_menu_pdf_path():
    """La carta en PDF está estrictamente prohibida; se utilizan imágenes o carta web."""
    return None

async def handle_customer_button_action_wa(from_phone: str, wa_name: str, btn_id: str, btn_text: str):
    """Procesa las acciones de los botones interactivos de bienvenida y carta para clientes."""
    from_phone = str(from_phone).replace("+", "").strip()
    
    if from_phone in attended_chats:
        attended_chats.discard(from_phone)
    unread_chats.add(from_phone)
    unread_counts[from_phone] = unread_counts.get(from_phone, 0) + 1
    save_chat_history()
    
    log_chat_message(from_phone, "client", wa_name, f"[🔘 {btn_text}]")
    
    if btn_id in ["btn_ver_carta", "btn_carta", "btn_carta_web", "btn_carta_pdf", "btn_hacer_pedido"]:
        web_msg = (
            "¡Claro que sí! 🥰 Aquí puedes ver toda nuestra carta digital interactiva:\n\n"
            "👉 https://caprichos.restaurant.pe/menu-digital/#/inicio/1\n\n"
            "⚡ Si realizas tu pedido directamente desde el menú web, ¡tus productos se prepararán y llegarán mucho más rápido! 🛵💨\n\n"
            "Si prefieres pedir por WhatsApp o ver fotos de la carta por aquí, ¡avísame y con mucho gusto te las comparto! 🥰"
        )
        await send_whatsapp_message(from_phone, web_msg)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", web_msg)
        return

    elif btn_id in ["btn_ya_se_que_pedir", "btn_pedir"]:
        b_path = os.path.join("assets", "CARTA1_BEBIDAS_Y_WAFFLES.jpg")
        if not os.path.exists(b_path):
            b_path = os.path.join("assets", "CARTA_BEBIDAS.png")
            
        s_path = os.path.join("assets", "CARTA2_SALADOS_Y_COMPLEMENTOS.jpg")
        if not os.path.exists(s_path):
            s_path = os.path.join("assets", "CARTA_SALADOS.png")
            
        if os.path.exists(b_path):
            await send_whatsapp_image_detailed(from_phone, b_path, caption="🍹 *Carta de Bebidas y Frappés*")
            log_chat_message(from_phone, "bot", "Capri 👩‍💻", "[Foto enviada: Carta Bebidas]", media_type="image", media_url="/assets/CARTA_BEBIDAS.png")
        if os.path.exists(s_path):
            await send_whatsapp_image_detailed(from_phone, s_path, caption="🍔 *Carta de Salados, Waffles y Postres*")
            log_chat_message(from_phone, "bot", "Capri 👩‍💻", "[Foto enviada: Carta Salados]", media_type="image", media_url="/assets/CARTA_SALADOS.png")
            
        direct_msg = (
            "¡Excelente! 🥰 Aquí te comparto nuestra carta en imágenes para ayudarte a elegir tus favoritos 📸👇\n\n"
            "Cuéntame, ¿qué se te antoja pedir hoy? 🍹🍔"
        )
        await send_whatsapp_message(from_phone, direct_msg)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", direct_msg)
        return

    elif btn_id == "btn_consultar_pedido":
        consult_msg = (
            "Con mucho gusto te ayudamos a verificar el estado de tu pedido 👩‍🍳🛵.\n\n"
            "Por favor, indícanos:\n"
            "1️⃣ El *Nombre completo* con el que registraste el pedido en la página web.\n"
            "2️⃣ El *Número de celular* registrado.\n\n"
            "Así nuestro equipo de cocina y despacho podrá ubicarlo rápidamente en el sistema 📋🔍."
        )
        waiting_order_query_users.add(from_phone)
        save_user_sessions()
        await send_whatsapp_message(from_phone, consult_msg)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", consult_msg)
        return

    elif btn_id == "btn_consulta_producto":
        query_msg = (
            "¡Hola! 🥰 Con gusto resolvemos tus dudas sobre nuestra carta, postres, bebidas o promociones.\n\n"
            "Cuéntanos brevemente, ¿cuál es tu consulta o duda? ☕🍰"
        )
        await send_whatsapp_message(from_phone, query_msg)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", query_msg)
        return

def is_order_ready_for_ticket(session_id: str, ai_reply: str, has_photo: bool = False) -> bool:
    """Verifica si la respuesta del bot o el contexto indican que el pedido fue registrado o requiere validación de pago."""
    ai_lower = ai_reply.lower()
    
    triggers = [
        "asesor lo validará", "asesor lo validara", "asesor validará", "asesor validara",
        "un asesor", "validará para preparar", "validara para preparar", "validará tu orden",
        "validara tu orden", "validará su orden", "validara su orden", "validar tu orden",
        "validar su orden", "preparar tu orden", "preparar su orden", "preparar tu pedido",
        "preparar su pedido", "gracias por tu compra", "gracias por su compra", "pedido registrado",
        "recibí tu comprobante", "recibi tu comprobante", "recibimos tu comprobante", "recibimos su comprobante",
        "área encargada", "area encargada", "comprobante recibido", "orden registrada",
        "anotado pago en efectivo", "vuelto exacto", "pos contra entrega", "contra entrega con pos"
    ]
    if any(t in ai_lower for t in triggers):
        return True
        
    if has_photo and any(w in ai_lower for w in [
        "comprobante", "operación", "operacion", "monto", "yape", "plin", 
        "transferencia", "bcp", "interbank", "recibí", "recibi", "recibido", "validar", "voucher", "pago"
    ]):
        return True
        
    return False

async def check_and_send_ticket_to_whatsapp_admin(session_id: str, wa_name: str, ai_reply: str, photo_bytes: bytes = None) -> None:
    """
    Revisa si la IA confirmó el pedido, comprobante o atención humana.
    Traslada de inmediato el chat a la pestaña REQUIERE ATENCIÓN, pausa el bot y guarda
    el último resumen del pedido para visualizarlo y copiar los productos en el Panel Web.
    (Ya no se envía al WhatsApp 977503006).
    """
    if not is_order_ready_for_ticket(session_id, ai_reply, has_photo=bool(photo_bytes)):
        return

    # Pausar el bot y trasladar a la pestaña Requiere Atención
    requires_worker_chats[session_id] = "Pedido por preparar / Validar pago"
    pending_validation_users_wa.add(session_id)

    # Generar y almacenar el último resumen del pedido para el Punto de Venta (POS)
    ticket_text = await generate_kitchen_ticket(session_id, wa_name)
    latest_order_summaries[session_id] = ticket_text
    save_chat_history()
    save_user_sessions()

    logger.info(f"📋 Pedido de {session_id} trasladado a REQUIERE ATENCIÓN con resumen listo para el Panel Web.")


# ----------------------------------------------------
# PARSER DE COORDENADAS GPS
# ----------------------------------------------------
def parse_dms_coordinates(text: str):
    pattern = r'(\d+)°(\d+)[\'′]\s*([\d.]+)[\"″]?\s*([NSns])[\s,]+(\d+)°(\d+)[\'′]\s*([\d.]+)[\"″]?\s*([EWewOow])'
    match = re.search(pattern, text)
    if match:
        d1, m1, s1, dir1, d2, m2, s2, dir2 = match.groups()
        lat = (float(d1) + float(m1)/60 + float(s1)/3600) * (-1 if dir1.upper() == 'S' else 1)
        lon = (float(d2) + float(m2)/60 + float(s2)/3600) * (-1 if dir2.upper() in ['W', 'O'] else 1)
        return lat, lon
    return None

async def extract_coordinates_from_text(text: str):
    if not text:
        return None
    dms_coords = parse_dms_coordinates(text)
    if dms_coords:
        return dms_coords

    short_link_match = re.search(r"(https?://maps\.app\.goo\.gl/[a-zA-Z0-9_-]+)", text)
    if short_link_match:
        short_url = short_link_match.group(1)
        try:
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(short_url, follow_redirects=True)
                text += " " + str(response.url)
        except Exception as e:
            logger.error(f"Error resolviendo enlace de Google Maps: {e}")

    dms_coords_post = parse_dms_coordinates(text)
    if dms_coords_post:
        return dms_coords_post

    maps_match = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", text)
    if maps_match:
        return float(maps_match.group(1)), float(maps_match.group(2))

    search_match = re.search(r"search/(-?\d+\.\d+),?\+?(-?\d+\.\d+)", text)
    if search_match:
        return float(search_match.group(1)), float(search_match.group(2))

    q_match = re.search(r"(?:q|ll|place)/?(-?\d+\.\d+)[,\+]+(-?\d+\.\d+)", text)
    if q_match:
        return float(q_match.group(1)), float(q_match.group(2))

    d_match = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", text)
    if d_match:
        return float(d_match.group(1)), float(d_match.group(2))

    plain_match = re.search(r"(-?\d+\.\d+)[\s,\+]+(-?\d+\.\d+)", text)
    if plain_match:
        lat, lon = float(plain_match.group(1)), float(plain_match.group(2))
        if -25 <= lat <= 5 and -85 <= lon <= -60:
            return lat, lon
        
    return None

# ----------------------------------------------------
# SERVIDOR FASTAPI Y WEBHOOKS DE META
# ----------------------------------------------------
app = FastAPI(title="Bot Caprichos WhatsApp")
os.makedirs("uploads", exist_ok=True)
if os.path.exists("assets"):
    app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

async def midnight_auto_resume_task():
    """Tarea en segundo plano que corre a las 00:00 (America/Lima) para despausar y limpiar chats pendientes."""
    tz = pytz.timezone("America/Lima")
    while True:
        try:
            now = datetime.now(tz)
            tomorrow = now.date() + timedelta(days=1)
            next_midnight = tz.localize(datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 5))
            sleep_seconds = (next_midnight - now).total_seconds()
            if sleep_seconds <= 0:
                sleep_seconds = 60
            logger.info(f"🌙 Tarea de medianoche programada en {sleep_seconds:.1f} segundos ({next_midnight.strftime('%Y-%m-%d %H:%M:%S')})")
            await asyncio.sleep(sleep_seconds)
            
            logger.info("🌙 Medianoche en Lima: Ejecutando auto-resume y limpieza diaria...")
            cleared_val = len(pending_validation_users_wa)
            cleared_req = len(requires_worker_chats)
            pending_validation_users_wa.clear()
            requires_worker_chats.clear()
            waiting_order_query_users.clear()
            save_user_sessions()
            save_chat_history()
            logger.info(f"✨ Medianoche completada: {cleared_val} chats despausados y {cleared_req} alertas de trabajador limpiadas.")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"❌ Error en midnight_auto_resume_task: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Bot de Caprichos WhatsApp (Capri 👩‍💻) iniciado y listo para recibir mensajes.")
    asyncio.create_task(midnight_auto_resume_task())

@app.get("/webhook")
async def verify_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    """Endpoint GET requerido por Meta para validar la URL del Webhook."""
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        logger.info("✅ Webhook verificado exitosamente con Meta WhatsApp Cloud API.")
        return PlainTextResponse(content=challenge, status_code=200)
    else:
        logger.error(f"❌ Fallo en la verificación del webhook. Token esperado: {WHATSAPP_VERIFY_TOKEN}, recibido: {token}")
        raise HTTPException(status_code=403, detail="Verification token mismatch")

# ----------------------------------------------------
# DEBOUNCER / AGRUPADOR DE MENSAJES CONSECUTIVOS (2 SEGUNDOS)
# ----------------------------------------------------
DEBOUNCE_DELAY = 2.0  # Tiempo de espera en segundos para agrupar mensajes seguidos (2s para respuesta de 2-4s)

wa_user_buffers = {}
wa_user_debounce_tasks = {}
wa_user_pending_photos = {}
wa_user_pending_system_msgs = {}

async def process_debounced_messages_wa(from_phone: str, wa_name: str):
    """Espera DEBOUNCE_DELAY segundos para consolidar mensajes consecutivos antes de responder."""
    try:
        await asyncio.sleep(DEBOUNCE_DELAY)
    except asyncio.CancelledError:
        return

    messages_list = wa_user_buffers.pop(from_phone, [])
    photo_info = wa_user_pending_photos.pop(from_phone, None)
    hidden_sys = wa_user_pending_system_msgs.pop(from_phone, None)
    wa_user_debounce_tasks.pop(from_phone, None)

    # 0. AVISO ESPECIAL DE CORTE DE ENERGÍA (SOLO POR HOY):
    if is_special_notice_active():
        if from_phone not in special_notice_notified_users:
            logger.info(f"📢 Enviando aviso especial de corte de energía con imagen a {from_phone}...")
            sent = False
            if os.path.exists(SPECIAL_NOTICE_IMAGE_PATH):
                sent, _ = await send_whatsapp_image_detailed(from_phone, SPECIAL_NOTICE_IMAGE_PATH, caption=SPECIAL_NOTICE_TEXT)
            if not sent:
                await send_whatsapp_message_detailed(from_phone, SPECIAL_NOTICE_TEXT)
            
            log_chat_message(from_phone, "bot", "Capri 👩‍💻", SPECIAL_NOTICE_TEXT)
            special_notice_notified_users.add(from_phone)
            save_special_notice_notified(special_notice_notified_users)
            logger.info(f"✅ Aviso de corte enviado a {from_phone}. El bot permanecerá en silencio para este usuario el resto del día.")
            return
        else:
            logger.info(f"🤐 Mensaje recibido de {from_phone}, pero ya se le envió el aviso de corte hoy. El bot no responderá nada.")
            return

    # 1. VERIFICACIÓN DE EXPIRACIÓN DE SESIÓN (3 HORAS) Y DESPAUSA AUTOMÁTICA:
    now_ts = datetime.now().timestamp()
    raw_last_ts = user_last_activity.get(from_phone)
    if not raw_last_ts:
        # Si no está en memoria RAM, buscar el timestamp del último mensaje registrado
        logs = chat_logs_history.get(from_phone, [])
        if logs and isinstance(logs[-1], dict) and "timestamp" in logs[-1]:
            raw_last_ts = logs[-1]["timestamp"]
    
    last_epoch = parse_timestamp_to_epoch(raw_last_ts)
    if last_epoch is not None:
        elapsed = now_ts - last_epoch
        if elapsed > SESSION_TIMEOUT_SECONDS:
            logger.info(f"⌛ Sesión expirada por inactividad para {from_phone} ({elapsed/3600:.1f}h). Desbloqueando y reseteando...")
            user_sessions.pop(from_phone, None)
            user_gps.pop(from_phone, None)
            pending_validation_users_wa.discard(from_phone)
            requires_worker_chats.pop(from_phone, None)
            save_user_sessions()
    elif from_phone in pending_validation_users_wa:
        # Si no hay timestamp de actividad previa y estaba pausado, despausar para no dejar clientes mudos
        logger.info(f"🔓 Desbloqueando chat {from_phone} de pending_validation por falta de sesión activa reciente.")
        pending_validation_users_wa.discard(from_phone)
        save_user_sessions()

    # Mantener actualizada la actividad del usuario en memoria RAM
    user_last_activity[from_phone] = now_ts

    # 2. REGLA DE PAUSA: Si el usuario tiene un pedido pendiente de validación en la misma sesión activa, no responder
    if from_phone in pending_validation_users_wa:
        logger.info(f"🤐 El bot no responderá a {from_phone} porque su pedido está pendiente de aprobación por el Admin en Telegram/WhatsApp.")
        return

    if not messages_list and not photo_info:
        return

    combined_text = "\n".join([m for m in messages_list if m])
    norm_text = normalize_text(combined_text)

    # 0. A) RESPUESTA A CONSULTA DE PEDIDO WEB (esperando nombre y celular de registro web)
    if from_phone in waiting_order_query_users and not photo_info:
        waiting_order_query_users.discard(from_phone)
        save_user_sessions()
        
        reply_confirm = "¡Muchas gracias! Ya estamos consultando el estado de tu pedido con el equipo de cocina y despacho con los datos brindados 👩‍🍳🛵. En breve te daremos respuesta por aquí."
        await send_whatsapp_message(from_phone, reply_confirm)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", reply_confirm)
        
        clean_query_text = " - ".join([line.strip() for line in combined_text.splitlines() if line.strip()]) if combined_text else ""
        requires_worker_chats[from_phone] = f"Consulta Pedido Web: {clean_query_text}"
        pending_validation_users_wa.add(from_phone)
        c_name = user_names.get(from_phone, wa_name)
        asyncio.create_task(send_admin_whatsapp_notification(
            f"🚨 *[CONSULTA DE PEDIDO WEB]* 🚨\n\n"
            f"👤 *Cliente:* {c_name} ({from_phone})\n"
            f"📝 *Datos brindados:* \"{combined_text}\"\n\n"
            f"📱 *Abrir chat:* https://wa.me/{from_phone}\n\n"
            f"⚠️ El cliente solicita verificar su pedido web. Por favor revisar en RestaurantPE / Cocina y responderle."
        ))
        return

    # 0. B) DETECCIÓN DIRECTA DE PEDIDO DE CARTA EN FOTOS / IMÁGENES:
    is_asking_carta_images = (
        ("carta" in norm_text or "menu" in norm_text) and 
        any(w in norm_text for w in ["foto", "fotos", "imagen", "imagenes", "fotito", "fotitos", "pdf o imagen", "pdf o fotos"])
    ) or any(k in norm_text for k in [
        "carta en fotos", "carta en imagenes", "carta en imagen", "fotos de la carta", 
        "imagenes de la carta", "imagen de la carta", "foto de la carta", 
        "carta fotos", "carta imagenes"
    ])

    if is_asking_carta_images and not photo_info:
        logger.info(f"📸 Solicitud directa de carta en imágenes detectada de {from_phone}: '{combined_text}'")
        b_path = os.path.join("assets", "CARTA_BEBIDAS.png")
        s_path = os.path.join("assets", "CARTA_SALADOS.png")
        if os.path.exists(b_path):
            await send_whatsapp_image_detailed(from_phone, b_path, caption="🍹 *Carta de Bebidas y Frappés*")
            log_chat_message(from_phone, "bot", "Capri 👩‍💻", "[Foto enviada: Carta Bebidas]", media_type="image", media_url="/assets/CARTA_BEBIDAS.png")
        if os.path.exists(s_path):
            await send_whatsapp_image_detailed(from_phone, s_path, caption="🍔 *Carta de Salados, Waffles y Postres*")
            log_chat_message(from_phone, "bot", "Capri 👩‍💻", "[Foto enviada: Carta Salados]", media_type="image", media_url="/assets/CARTA_SALADOS.png")
            
        reply_msg = "¡Con mucho gusto! 🥰 Te comparto las imágenes de nuestra carta completa 📸✨.\n\nCuéntame, ¿qué se te antoja pedir hoy? 🍹🍔"
        await send_whatsapp_message(from_phone, reply_msg)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", reply_msg)
        return

    # 0. C) RESPUESTAS POR TEXTO A LAS OPCIONES DE BOTONES
    btn_text_mapping = {
        "1": "btn_ver_carta",
        "carta": "btn_ver_carta",
        "ver carta": "btn_ver_carta",
        "la carta": "btn_ver_carta",
        "carta digital": "btn_ver_carta",
        "ver carta digital": "btn_ver_carta",
        "la carta digital": "btn_ver_carta",
        "carta web": "btn_ver_carta",
        "ver carta web": "btn_ver_carta",
        "menu": "btn_ver_carta",
        "menú": "btn_ver_carta",
        "ver menu": "btn_ver_carta",
        "ver menú": "btn_ver_carta",
        "menu digital": "btn_ver_carta",
        "2": "btn_ya_se_que_pedir",
        "ya se que pedir": "btn_ya_se_que_pedir",
        "ya sé qué pedir": "btn_ya_se_que_pedir",
        "ya se que quiero": "btn_ya_se_que_pedir",
        "ya sé que quiero": "btn_ya_se_que_pedir",
        "quiero pedir": "btn_ya_se_que_pedir",
        "pedir": "btn_ya_se_que_pedir",
        "hacer pedido": "btn_ya_se_que_pedir",
        "quiero hacer un pedido": "btn_ya_se_que_pedir",
        "consultar pedido": "btn_consultar_pedido",
        "consultar mi pedido": "btn_consultar_pedido"
    }
    if norm_text in btn_text_mapping:
        await handle_customer_button_action_wa(from_phone, wa_name, btn_text_mapping[norm_text], combined_text)
        return

    # 0. D) SALUDO INICIAL Y BOTONES INTERACTIVOS (SIN EXIGIR NOMBRE POR ADELANTADO)
    greetings = [
        "hola", "buenas", "buenos dias", "buenos días", "buenas tardes", "buenas noches", 
        "buen dia", "buen día", "hola buenas", "hola que tal", "hola qué tal", "hi", "hello", 
        "ola", "hola caprichos", "buenas caprichos", "hey", "saludos"
    ]
    is_pure_greeting = (norm_text in greetings) or (len(norm_text) <= 25 and any(norm_text.startswith(g) for g in greetings))
    has_active_session = from_phone in user_sessions and len(user_sessions[from_phone]) > 0
    
    order_words = ["quiero", "deseo", "pedir", "frappe", "frappé", "waffle", "sandwich", "sándwich", "empanada", "dona", "torta", "combo", "duo", "dúo", "americano", "cappuccino", "chocolate", "iced", "frozen"]
    has_order_intent = any(w in norm_text for w in order_words)

    if (not has_active_session or is_pure_greeting) and not has_order_intent and not photo_info:
        client_data = get_client_data(from_phone)
        is_registered = (
            client_data and 
            client_data.get("nombre") and 
            client_data.get("nombre").strip() not in ["Cliente Caprichos", "", "[Nombre y Apellido]"] and
            not client_data.get("nombre").strip().isdigit()
        )
        
        welcome_buttons_text = "¡Hola! Soy Capri 👩‍💻. ¿En qué te puedo ayudar hoy? 🥰"
        welcome_buttons = [
            {"id": "btn_ver_carta", "title": "Carta🧋"},
            {"id": "btn_ya_se_que_pedir", "title": "Ya sé qué pedir⚡"}
        ]
        success, _ = await send_whatsapp_interactive_buttons_detailed(from_phone, welcome_buttons_text, welcome_buttons)
        if not success:
            fallback = (
                f"{welcome_buttons_text}\n\n"
                "1️⃣ *Carta 🖼️*\n"
                "2️⃣ *Ya sé qué pedir 🛍️*\n\n"
                "Escríbenos el número o nombre de la opción deseada 😊."
            )
            await send_whatsapp_message(from_phone, fallback)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", welcome_buttons_text)
        return

    # A) Respuestas breves de cortesía si el pedido ya fue aprobado previamente por el Admin
    if from_phone in recently_approved_chats and not photo_info:
        short_tokens = ["ok", "ya", "gracias", "muchas gracias", "listo", "vale", "perfecto", "de nada", "ta bien", "esta bien", "ahi voy", "ya voy", "comprendido", "entendido", "jeje", "xd", "muchas gracias", "ok gracias", "ya gracias"]
        if norm_text in short_tokens:
            logger.info(f"✨ Acuse de recibo breve detectado de {from_phone} tras aprobación ('{combined_text}'). Respondiendo cortesía...")
            short_reply = "¡Con mucho gusto! Quedamos muy atentos 🥰🍹✨"
            await send_whatsapp_message(from_phone, short_reply)
            log_chat_message(from_phone, "bot", "Capri 👩‍💻", short_reply)
            return

    # B) Detección de consultas sobre estado de pedido / demora / RestaurantPE
    order_status_triggers = [
        "no llega mi pedido", "no llega el pedido", "mi pedido no llega", "novedad de mi pedido",
        "mi pedido ya llegara", "mi pedido esta por llegar", "ya llega mi pedido", "ya llegara mi pedido",
        "ya esta listo mi pedido", "ya esta listo para", "ya anda listo", "cuanto falta para mi pedido",
        "cuanto falta para que llegue", "hace una hora y nada", "hace cuanto demora mi pedido",
        "esta listo mi pedido", "saber de mi pedido", "donde esta mi pedido", "estado de mi pedido",
        "avisa si esta listo", "avisame si esta listo", "ninguna novedad de mi pedido", "alguna novedad de mi pedido"
    ]
    is_status_query = any(t in norm_text for t in order_status_triggers)
    if not is_status_query and ("pedido" in norm_text or "orden" in norm_text):
        if any(w in norm_text for w in ["demora", "tarda", "novedad", "llega", "llegar", "listo", "recogerlo", "cocina", "camino", "hace una hora"]):
            if not any(w in norm_text for w in ["hacer pedido", "tomar pedido", "quiero un", "deseo pedir", "para pedir", "hacer un pedido"]):
                is_status_query = True

    if is_status_query and not photo_info:
        logger.info(f"🔍 Consulta de estado de pedido/RestaurantPE detectada de {from_phone}: '{combined_text}'")
        status_reply = "¡Hola! En este momento estamos consultando el estado de tu pedido con el equipo de cocina y despacho en nuestro sistema. Denos un momento por favor para verificarlo y responderle 👩‍🍳🛵."
        await send_whatsapp_message(from_phone, status_reply)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", status_reply)
        
        # Pausar y marcar como Requiere Trabajador en el Panel Web
        requires_worker_chats[from_phone] = "Consulta sobre estado / Demora de pedido (RestaurantPE)"
        pending_validation_users_wa.add(from_phone)
        asyncio.create_task(send_admin_whatsapp_notification(
            f"🚨 *[CONSULTA DE ESTADO / RESTAURANTPE]* 🚨\n\n"
            f"👤 *Cliente:* {wa_name} ({from_phone})\n"
            f"💬 *Mensaje:* \"{combined_text}\"\n\n"
            f"📱 *Abrir chat:* https://wa.me/{from_phone}\n\n"
            f"⚠️ El bot respondió con mensaje de espera y se pausó para que revises en RestaurantPE/Cocina."
        ))
        return

    # C) Si el cliente envía un número de 9 dígitos para registro de celular, guardarlo en memoria
    phone_digits_match = re.search(r'\b(9\d{8})\b', combined_text)
    if phone_digits_match:
        detected_cel = phone_digits_match.group(1)
        save_client_info(from_phone, cel=detected_cel)
        logger.info(f"📱 Celular peruano detectado en texto ({detected_cel}) guardado para {from_phone}")

    if photo_info:
        base64_image, photo_bytes = photo_info
        ai_reply = await get_ai_response(
            from_phone,
            is_photo=True,
            photo_base64=base64_image,
            user_message=combined_text if combined_text else None,
            hidden_system_message=hidden_sys
        )
        await send_whatsapp_message(from_phone, ai_reply)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", ai_reply)
        await check_and_send_ticket_to_whatsapp_admin(from_phone, wa_name, ai_reply, photo_bytes=photo_bytes)
    else:
        ai_reply = await get_ai_response(
            from_phone,
            user_message=combined_text if combined_text else None,
            hidden_system_message=hidden_sys
        )
        await send_whatsapp_message(from_phone, ai_reply)
        log_chat_message(from_phone, "bot", "Capri 👩‍💻", ai_reply)
        await check_and_send_ticket_to_whatsapp_admin(from_phone, wa_name, ai_reply)

def add_to_user_buffer_wa(from_phone: str, wa_name: str, text: str = None, photo_info = None, hidden_sys = None, location_url = None):
    if not from_phone or str(from_phone).strip().lower() in ["none", "null", "undefined", ""]:
        return
    from_phone = str(from_phone).replace("+", "").strip()
    if from_phone not in wa_user_buffers:
        wa_user_buffers[from_phone] = []
    
    # Si el chat estaba marcado como "Atendido", se desmarca automáticamente por nuevo mensaje del cliente
    if from_phone in attended_chats:
        attended_chats.discard(from_phone)
        logger.info(f"🔄 Chat {from_phone} desmarcado de 'Atendido' por nuevo mensaje entrante del cliente.")
    
    # Marcar como No Leído (punto verde y contador) por nuevo mensaje entrante del cliente
    unread_chats.add(from_phone)
    unread_counts[from_phone] = unread_counts.get(from_phone, 0) + 1
    save_chat_history()
    
    if text:
        wa_user_buffers[from_phone].append(text)

    if photo_info:
        wa_user_pending_photos[from_phone] = photo_info
        base64_img, photo_bytes = photo_info
        media_url = None
        try:
            os.makedirs("uploads", exist_ok=True)
            img_fname = f"uploads/img_{from_phone}_{int(datetime.now().timestamp())}.jpg"
            if photo_bytes:
                with open(img_fname, "wb") as f_img:
                    f_img.write(photo_bytes)
                media_url = f"/{img_fname}"
            elif base64_img:
                raw_b = base64.b64decode(base64_img)
                with open(img_fname, "wb") as f_img:
                    f_img.write(raw_b)
                media_url = f"/{img_fname}"
        except Exception as err_save_img:
            logger.error(f"Error guardando imagen entrante en uploads/: {err_save_img}")
            media_url = None
        log_chat_message(from_phone, "client", wa_name, text or "[Imagen / Voucher de pago enviado]", media_type="image", media_url=media_url)
    elif location_url:
        log_chat_message(from_phone, "client", wa_name, text or "[Ubicación GPS compartida]", location_url=location_url)
    elif text:
        log_chat_message(from_phone, "client", wa_name, text)

    if hidden_sys:
        wa_user_pending_system_msgs[from_phone] = hidden_sys

    if from_phone in wa_user_debounce_tasks and not wa_user_debounce_tasks[from_phone].done():
        wa_user_debounce_tasks[from_phone].cancel()

    wa_user_debounce_tasks[from_phone] = asyncio.create_task(process_debounced_messages_wa(from_phone, wa_name))

async def process_incoming_msg_wa(msg: dict, wa_name: str, canonical_id: str = None):
    """Procesa mensajes de WhatsApp en segundo plano para no demorar la respuesta 200 OK a Meta."""
    raw_from = canonical_id or msg.get("from") or msg.get("from_user_id") or msg.get("sender_id")
    if not raw_from:
        logger.warning(f"Mensaje omitido: no contiene 'from' ni 'from_user_id': {msg}")
        return
    
    from_phone = str(raw_from).replace("+", "").strip()
    if not from_phone or from_phone.lower() in ["none", "null", "undefined"]:
        logger.warning(f"Identificador inválido detectado '{raw_from}', ignorando evento.")
        return

    msg_type = msg.get("type", "")
    msg_id = msg.get("id")
    if msg_id and from_phone:
        user_last_wamid[from_phone] = msg_id
    user_names[from_phone] = wa_name

    # 1. MENSAJE DE TEXTO
    if msg_type == "text":
        text_body = msg.get("text", {}).get("body", "")
        coords = await extract_coordinates_from_text(text_body)
        mensaje_sistema = None
        loc_url = None
        if coords:
            lat, lon = coords
            loc_url = f"https://www.google.com/maps?q={lat},{lon}"
            costo_delivery = calculate_delivery_cost(lat, lon)
            costo_delivery = get_client_delivery_cost(from_phone, costo_delivery)
            user_gps[from_phone] = {'lat': lat, 'lon': lon}
            save_user_sessions()
            if costo_delivery == -1:
                mensaje_sistema = (
                    "UBICACIÓN GPS RECIBIDA: El sistema de mapas calculó que la ubicación del cliente ESTÁ FUERA DE LA ZONA DE REPARTO (sin cobertura). "
                    "Infórmale amablemente que lamentablemente su dirección se encuentra fuera de nuestra zona de reparto de delivery, y pregúntale si preferiría registrar su pedido para Recojo en Tienda."
                )
            elif costo_delivery is None:
                mensaje_sistema = (
                    "UBICACIÓN GPS RECIBIDA: El sistema no pudo determinar el polígono de delivery. Asume costo de delivery S/ 0 por ahora o consúltale su zona de referencia."
                )
            else:
                mensaje_sistema = (
                    f"UBICACIÓN GPS RECIBIDA: El sistema de mapas calculó que el costo de delivery es de S/ {costo_delivery} (recuerda que si el consumo en productos supera los S/ 70, la herramienta `calcular_total_pedido` lo descontará a GRATIS). "
                    f"INSTRUCCIÓN OBLIGATORIA: Llama de inmediato a la herramienta `calcular_total_pedido` pasando todos los productos de la orden y `delivery_cost={costo_delivery}`. "
                    "Una vez obtenida la respuesta de la herramienta, preséntale al cliente el desglose exacto con el total final a pagar y pregúntale exactamente: '¿Todo conforme con su pedido para proceder con el pago?'."
                )
        else:
            address_keywords = ["ubicacion", "ubicación", "pasaje", "frente a", "av", "avenida", "calle", "jiron", "jirón", "estadio", "manzana", "mz", "lote", "lt", "cuadra", "referencia", "barrio", "urbanizacion", "urbanización"]
            if any(kw in text_body.lower() for kw in address_keywords):
                mensaje_sistema = (
                    "REGLA DE UBICACIÓN POR TEXTO: El cliente intentó enviar su dirección escrita en texto. NO ACEPTES ESTA DIRECCIÓN ESCRITA EN TEXTO. "
                    "Explícale amablemente que no podemos procesar direcciones por texto porque Google Maps presenta múltiples lugares con el mismo nombre "
                    "y nuestro delivery se guía exclusivamente por coordenadas GPS de WhatsApp. Pídele e insiste en que comparta su UBICACIÓN ACTUAL "
                    "enviada desde el botón de adjuntar ubicación de WhatsApp (clip 📎 -> Ubicación)."
                )
                
        add_to_user_buffer_wa(from_phone, wa_name, text=text_body, hidden_sys=mensaje_sistema, location_url=loc_url)

    # 2. RESPUESTAS INTERACTIVAS (BOTONES, LISTAS O CATÁLOGOS DE WHATSAPP)
    elif msg_type == "interactive":
        interactive = msg.get("interactive", {})
        itype = interactive.get("type")
        btn_text = ""
        btn_id = ""
        if itype == "button_reply":
            b_reply = interactive.get("button_reply", {})
            btn_text = b_reply.get("title", "")
            btn_id = b_reply.get("id", "")
        elif itype == "list_reply":
            l_reply = interactive.get("list_reply", {})
            btn_text = l_reply.get("title", "")
            btn_id = l_reply.get("id", "")
        elif itype == "nfm_reply":
            btn_text = interactive.get("nfm_reply", {}).get("response_json", "Respuesta enviada")

        # Interceptar pulsación de botones de aprobación / rechazo de Cocina / Admin
        if btn_id and (btn_id.startswith("approve_") or btn_id.startswith("reject_")):
            logger.info(f"🔘 Acción de botón interactivo recibida de admin {from_phone}: btn_id='{btn_id}', text='{btn_text}'")
            await handle_admin_order_action_wa(admin_phone=from_phone, action_id=btn_id, btn_title=btn_text)
            return

        # Interceptar botones interactivos de cliente (bienvenida, carta, consulta)
        if btn_id and btn_id.startswith("btn_"):
            logger.info(f"🔘 Botón interactivo de cliente recibido de {from_phone}: btn_id='{btn_id}', text='{btn_text}'")
            await handle_customer_button_action_wa(from_phone, wa_name, btn_id, btn_text)
            return

        if not btn_text:
            btn_text = "[Opción seleccionada]"

        logger.info(f"🔘 Respuesta interactiva recibida de {from_phone}: '{btn_text}'")
        add_to_user_buffer_wa(from_phone, wa_name, text=btn_text)

    # 3. RESPUESTAS DE BOTÓN SIMPLE
    elif msg_type == "button":
        btn_payload = msg.get("button", {}).get("payload", "")
        btn_text = msg.get("button", {}).get("text", "[Botón presionado]")

        if btn_payload and (btn_payload.startswith("approve_") or btn_payload.startswith("reject_")):
            logger.info(f"🔘 Acción de botón simple recibida de admin {from_phone}: payload='{btn_payload}', text='{btn_text}'")
            await handle_admin_order_action_wa(admin_phone=from_phone, action_id=btn_payload, btn_title=btn_text)
            return

        if btn_payload and btn_payload.startswith("btn_"):
            logger.info(f"🔘 Botón simple de cliente recibido de {from_phone}: payload='{btn_payload}', text='{btn_text}'")
            await handle_customer_button_action_wa(from_phone, wa_name, btn_payload, btn_text)
            return

        logger.info(f"🔘 Botón simple presionado por {from_phone}: '{btn_text}'")
        add_to_user_buffer_wa(from_phone, wa_name, text=btn_text)

    # 4. MENSAJE DE AUDIO / NOTA DE VOZ
    elif msg_type in ["audio", "voice"]:
        audio_info = msg.get(msg_type, {})
        media_id = audio_info.get("id")
        audio_bytes = await get_whatsapp_media_bytes(media_id) if media_id else None
        
        if audio_bytes:
            texto_transcrito = await transcribe_audio_bytes(audio_bytes)
            if texto_transcrito:
                logger.info(f"🎙️ Nota de voz de {from_phone} transcrita con éxito: '{texto_transcrito}'")
                add_to_user_buffer_wa(from_phone, wa_name, text=texto_transcrito)
            else:
                logger.warning(f"No se pudo transcribir el audio de {from_phone}, notificando al bot...")
                add_to_user_buffer_wa(from_phone, wa_name, text="[Nota de voz]", hidden_sys="El cliente envió un mensaje de voz pero la calidad no permitió transcribirlo con precisión. Pídele amablemente si puede escribir su pedido o consulta por mensaje de texto.")
        else:
            add_to_user_buffer_wa(from_phone, wa_name, text="[Nota de voz]", hidden_sys="El cliente envió un audio pero no se pudo descargar. Pídele amablemente si puede escribir su mensaje.")

    # 5. MENSAJE DE UBICACIÓN NATIVA DE WHATSAPP
    elif msg_type == "location":
        loc = msg.get("location", {})
        lat, lon = loc.get("latitude"), loc.get("longitude")
        loc_url = f"https://www.google.com/maps?q={lat},{lon}" if lat and lon else None
        costo_delivery = calculate_delivery_cost(lat, lon) if lat and lon else None
        if costo_delivery is not None:
            costo_delivery = get_client_delivery_cost(from_phone, costo_delivery)
        if lat and lon:
            loc_dict = {'lat': lat, 'lon': lon, 'costo': costo_delivery, 'maps_url': loc_url}
            user_gps[from_phone] = loc_dict
            save_client_info(from_phone, location=loc_dict)
            save_user_sessions()
        if costo_delivery == -1:
            mensaje_sistema = (
                "UBICACIÓN GPS RECIBIDA: El sistema de mapas calculó que la ubicación del cliente ESTÁ FUERA DE LA ZONA DE REPARTO (sin cobertura). "
                "Infórmale amablemente que lamentablemente su dirección se encuentra fuera de nuestra zona de reparto de delivery, y pregúntale si preferiría registrar su pedido para Recojo en Tienda."
            )
        elif costo_delivery is None:
            mensaje_sistema = (
                "UBICACIÓN GPS RECIBIDA: El sistema no pudo determinar el polígono de delivery. Asume costo de delivery S/ 0 por ahora o consúltale su zona de referencia."
            )
        else:
            mensaje_sistema = (
                f"UBICACIÓN GPS RECIBIDA: El sistema de mapas calculó que el costo de delivery es de S/ {costo_delivery} (recuerda que si el consumo en productos supera los S/ 70, la herramienta `calcular_total_pedido` lo descontará a GRATIS). "
                f"INSTRUCCIÓN OBLIGATORIA: Llama de inmediato a la herramienta `calcular_total_pedido` pasando todos los productos de la orden y `delivery_cost={costo_delivery}`. "
                "Una vez obtenida la respuesta de la herramienta, preséntale al cliente el desglose exacto con el total final a pagar y pregúntale exactamente: '¿Todo conforme con su pedido para proceder con el pago?'."
            )
            
        add_to_user_buffer_wa(from_phone, wa_name, text="[He enviado mi ubicación GPS actual]", hidden_sys=mensaje_sistema, location_url=loc_url)

    # 6. IMÁGENES (Vouchers de pago o capturas de carta)
    elif msg_type == "image":
        image_info = msg.get("image", {})
        media_id = image_info.get("id")
        caption = image_info.get("caption", "")
        photo_bytes = await get_whatsapp_media_bytes(media_id) if media_id else None
        if photo_bytes:
            base64_image = base64.b64encode(photo_bytes).decode('utf-8')
            add_to_user_buffer_wa(from_phone, wa_name, text=caption, photo_info=(base64_image, photo_bytes))
        else:
            await send_whatsapp_message(from_phone, "Recibí tu imagen pero hubo un problema al procesarla. Por favor vuelve a enviarla 🙏.")

    # 7. STICKERS
    elif msg_type == "sticker":
        logger.info(f"✨ Sticker recibido de {from_phone}")
        add_to_user_buffer_wa(from_phone, wa_name, text="[Sticker]", hidden_sys="El cliente envió un sticker divertido. Salúdalo con calidez y buena vibra, y pregúntale qué se le antoja pedir hoy.")

    # 8. VIDEOS
    elif msg_type == "video":
        caption = msg.get("video", {}).get("caption", "")
        texto_msg = f"[Video enviado] {caption}".strip() if caption else "[Video enviado]"
        logger.info(f"📹 Video recibido de {from_phone}: {texto_msg}")
        add_to_user_buffer_wa(from_phone, wa_name, text=texto_msg, hidden_sys="El cliente envió un video. Si tiene texto, responde al texto. Si no, salúdalo amablemente y pregúntale qué se le apetece pedir.")

    # 9. DOCUMENTOS (PDFs u otros)
    elif msg_type == "document":
        doc = msg.get("document", {})
        filename = doc.get("filename", "documento")
        caption = doc.get("caption", "")
        texto_msg = f"[Documento: {filename}] {caption}".strip()
        logger.info(f"📄 Documento recibido de {from_phone}: {texto_msg}")
        add_to_user_buffer_wa(from_phone, wa_name, text=texto_msg, hidden_sys="El cliente envió un documento adjunto. Pregúntale amablemente en qué le puedes ayudar o si es un comprobante de pago.")

    # 10. OTROS MENSAJES
    elif msg_type not in ["reaction"]:
        logger.info(f"ℹ️ Tipo de mensaje no catalogado ({msg_type}) recibido de {from_phone}")
        add_to_user_buffer_wa(from_phone, wa_name, text="[Mensaje]", hidden_sys="El cliente envió un mensaje. Salúdalo amablemente y pregúntale en qué le puedes ayudar.")

@app.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """Endpoint POST que recibe los eventos de mensajes de Meta WhatsApp Cloud API y responde HTTP 200 al instante."""
    body = await request.json()
    logger.info(f"📥 Webhook body recibido: {json.dumps(body)}")
    
    # Validar que sea un evento de WhatsApp
    if body.get("object") != "whatsapp_business_account":
        return Response(content="Not a WhatsApp event", status_code=404)
        
    entries = body.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            contacts = value.get("contacts", [])
            
            # Mapear nombres de contacto por wa_id / user_id
            contact_names = {}
            if contacts:
                for c in contacts:
                    cid = str(c.get("wa_id") or c.get("user_id") or c.get("id") or "").strip()
                    c_clean = re.sub(r'^[A-Za-z]{2}\.', '', cid)
                    cname = c.get("profile", {}).get("name") or c.get("profile", {}).get("username")
                    if cid and cname:
                        contact_names[cid] = cname
                        contact_names[c_clean] = cname

            statuses = value.get("statuses", [])
            for s in statuses:
                s_id = s.get("recipient_id")
                s_status = s.get("status")
                s_errors = s.get("errors")
                if s_errors:
                    logger.error(f"❌ Error de entrega Meta para {s_id}: {s_errors}")
                else:
                    logger.info(f"📬 Estado de entrega Meta para {s_id}: {s_status}")

            for msg in messages:
                raw_id = str(msg.get("from") or msg.get("from_user_id") or msg.get("sender_id") or "").strip()
                clean_id = re.sub(r'^[A-Za-z]{2}\.', '', raw_id)
                wa_name = contact_names.get(raw_id) or contact_names.get(clean_id) or "Cliente WhatsApp"
                if wa_name == "Cliente WhatsApp" and contacts:
                    wa_name = contacts[0].get("profile", {}).get("name") or contacts[0].get("profile", {}).get("username", "Cliente WhatsApp")
                background_tasks.add_task(process_incoming_msg_wa, msg, wa_name, raw_id)

    return Response(content="EVENT_RECEIVED", status_code=200)

# ----------------------------------------------------
# PANEL WEB DE MONITOREO E INTERVENCIÓN EN TIEMPO REAL
# ----------------------------------------------------
@app.post("/api/dashboard/login")
async def dashboard_login(request: Request):
    """Inicia sesión en el panel y guarda la cookie de autenticación."""
    data = await request.json()
    user = str(data.get("username", "")).strip()
    pwd = str(data.get("password", "")).strip()
    
    if user == ADMIN_PANEL_USER and pwd == ADMIN_PANEL_PASSWORD:
        resp = JSONResponse(content={"status": "success", "message": "Acceso concedido", "token": ADMIN_SESSION_TOKEN})
        resp.set_cookie(
            key="caprichos_admin_session",
            value=ADMIN_SESSION_TOKEN,
            max_age=86400 * 30, # 30 días de sesión activa
            path="/",
            samesite="lax",
            httponly=False
        )
        logger.info(f"🔑 Inicio de sesión exitoso en el Panel Web para '{user}'.")
        return resp
    else:
        logger.warning(f"⛔ Intento fallido de inicio de sesión en Panel Web para '{user}'.")
        return JSONResponse(status_code=401, content={"status": "error", "message": "Usuario o contraseña incorrectos"})

@app.post("/api/dashboard/logout")
async def dashboard_logout():
    """Cierra la sesión del panel eliminando la cookie."""
    resp = JSONResponse(content={"status": "success", "message": "Sesión cerrada"})
    resp.delete_cookie(key="caprichos_admin_session", path="/")
    return resp

@app.get("/api/dashboard/chats")
async def get_dashboard_chats(request: Request):
    """Retorna la lista de chats activos con su último mensaje, estado de pausa, pedido atendido, no leído y si requiere trabajador."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    chats_list = []
    raw_phones = list(user_sessions.keys()) + list(user_names.keys()) + list(chat_logs_history.keys()) + list(requires_worker_chats.keys()) + list(attended_chats) + list(unread_chats)
    all_phones = set()
    for p in raw_phones:
        if p and str(p).strip().lower() not in ["none", "null", "undefined", ""]:
            all_phones.add(str(p).strip())
    
    for phone in all_phones:
        name = get_client_display_name(phone)
        logs = chat_logs_history.get(phone, [])
        last_msg = logs[-1]["text"] if logs else "(Sin mensajes aún)"
        last_time = logs[-1]["timestamp"] if logs else ""
        is_paused = phone in pending_validation_users_wa
        is_attended = phone in attended_chats
        is_unread = phone in unread_chats
        unread_count_val = unread_counts.get(phone, 1 if is_unread else 0)
        requires_worker = phone in requires_worker_chats
        worker_reason = requires_worker_chats.get(phone, "")
        phone_national = get_national_peru_phone(phone)
        phone_formatted = format_peru_phone(phone)
        
        last_sender = logs[-1].get("sender", "") if logs else ""
        
        # Filtro estricto para 'Hoy': chats desde hoy a las 00:00:00 horas hasta las 23:59:59 horas en horario de Lima
        lima_tz = pytz.timezone('America/Lima')
        now_lima = datetime.now(lima_tz)
        today_date_str = now_lima.strftime('%Y-%m-%d')
        is_today = False
        if last_time:
            if str(last_time).startswith(today_date_str):
                is_today = True
            else:
                last_epoch = parse_timestamp_to_epoch(last_time)
                if last_epoch:
                    dt_msg = datetime.fromtimestamp(last_epoch, lima_tz)
                    is_today = (dt_msg.date() == now_lima.date())
        
        chats_list.append({
            "phone": str(phone),
            "phone_national": phone_national,
            "phone_formatted": phone_formatted,
            "name": name,
            "last_message": last_msg,
            "last_time": last_time,
            "last_sender": last_sender,
            "is_today": is_today,
            "is_paused": is_paused,
            "is_attended": is_attended,
            "is_unread": is_unread,
            "unread_count": unread_count_val,
            "requires_worker": requires_worker,
            "requires_worker_reason": worker_reason,
            "has_summary": bool(latest_order_summaries.get(str(phone), "")),
            "message_count": len(logs)
        })
    
    # Ordenar: primero los que requieren trabajador, luego los no leídos, luego por epoch más reciente
    chats_list.sort(key=lambda c: (
        not c["requires_worker"],
        not c["is_unread"],
        -(parse_timestamp_to_epoch(c["last_time"]) or 0)
    ))
    return JSONResponse(content={"chats": chats_list, "alta_demanda_mode": alta_demanda_mode, "tiempo_estimado": get_tiempo_estimado_str()}, headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})

@app.get("/api/dashboard/messages/{phone}")
async def get_dashboard_messages(phone: str, request: Request):
    """Retorna el historial completo de mensajes de un cliente con su estado de atención, lectura y último resumen de pedido."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    clean_phone = str(phone).strip()
    if not clean_phone or clean_phone.lower() in ["none", "null", "undefined"]:
        return JSONResponse(content={"phone": clean_phone, "name": "Inválido", "is_paused": False, "is_attended": False, "is_unread": False, "unread_count": 0, "requires_worker": False, "messages": [], "alta_demanda_mode": alta_demanda_mode, "tiempo_estimado": get_tiempo_estimado_str()})
        
    logs = chat_logs_history.get(clean_phone, [])
    is_paused = clean_phone in pending_validation_users_wa
    is_attended = clean_phone in attended_chats
    is_unread = clean_phone in unread_chats
    unread_count_val = unread_counts.get(clean_phone, 1 if is_unread else 0)
    requires_worker = clean_phone in requires_worker_chats
    worker_reason = requires_worker_chats.get(clean_phone, "")
    name = get_client_display_name(clean_phone)
    phone_national = get_national_peru_phone(clean_phone)
    phone_formatted = format_peru_phone(clean_phone)
    
    gps_info = user_gps.get(clean_phone)
    gps_url = f"https://www.google.com/maps?q={gps_info['lat']},{gps_info['lon']}" if gps_info and 'lat' in gps_info and 'lon' in gps_info else None
    
    return JSONResponse(content={
        "phone": clean_phone,
        "phone_national": phone_national,
        "phone_formatted": phone_formatted,
        "name": name,
        "is_paused": is_paused,
        "is_attended": is_attended,
        "is_unread": is_unread,
        "unread_count": unread_count_val,
        "requires_worker": requires_worker,
        "requires_worker_reason": worker_reason,
        "gps_url": gps_url,
        "latest_order_summary": latest_order_summaries.get(clean_phone, ""),
        "alta_demanda_mode": alta_demanda_mode,
        "tiempo_estimado": get_tiempo_estimado_str(),
        "messages": logs
    })

@app.get("/api/dashboard/order-summary/{phone}")
async def get_dashboard_order_summary(phone: str, request: Request):
    """Retorna el último resumen del pedido para visualizarlo o copiar productos al POS."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
    clean_p = str(phone).strip()
    summary = latest_order_summaries.get(clean_p, "")
    return JSONResponse(content={"phone": clean_p, "summary": summary})

@app.post("/api/dashboard/generate-summary")
async def generate_dashboard_order_summary_api(request: Request):
    """Genera bajo demanda el resumen del pedido a partir de la conversación para ingresar al POS."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
    data = await request.json()
    clean_p = str(data.get("phone", "")).strip()
    if not clean_p:
        raise HTTPException(status_code=400, detail="Teléfono requerido")
    c_name = user_names.get(clean_p, get_client_display_name(clean_p))
    ticket_text = await generate_kitchen_ticket(clean_p, c_name)
    latest_order_summaries[clean_p] = ticket_text
    save_chat_history()
    return JSONResponse(content={"phone": clean_p, "summary": ticket_text})

@app.post("/api/dashboard/mark-read")
async def mark_dashboard_chat_read(request: Request):
    """Marca un chat como leído al ser abierto por el operador."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    if not phone or phone.lower() in ["none", "null", "undefined"]:
        raise HTTPException(status_code=400, detail="Teléfono válido requerido")
        
    unread_chats.discard(phone)
    unread_counts[phone] = 0
    save_chat_history()
    return JSONResponse(content={"status": "success", "phone": phone, "is_unread": False, "unread_count": 0})

@app.post("/api/dashboard/resolve-worker")
async def resolve_worker_attention(request: Request):
    """Resuelve la alerta de 'Requiere Trabajador', despausa o marca atendido."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    mark_attended = bool(data.get("mark_attended", True))
    unpause = bool(data.get("unpause", True))

    if not phone or phone.lower() in ["none", "null", "undefined"]:
        raise HTTPException(status_code=400, detail="Teléfono válido requerido")
        
    requires_worker_chats.pop(phone, None)
    if mark_attended:
        attended_chats.add(phone)
        unread_chats.discard(phone)
        unread_counts[phone] = 0
    if unpause:
        pending_validation_users_wa.discard(phone)

    save_chat_history()
    logger.info(f"✅ Alerta de 'Requiere Trabajador' resuelta para {phone} desde Panel Web.")
    return JSONResponse(content={"status": "success", "phone": phone, "requires_worker": False, "is_attended": phone in attended_chats, "is_paused": phone in pending_validation_users_wa, "is_unread": phone in unread_chats, "unread_count": 0})

@app.post("/api/dashboard/toggle-pause")
async def toggle_dashboard_pause(request: Request):
    """Pausa o reanuda las respuestas del bot para un cliente específico."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    if not phone or phone.lower() in ["none", "null", "undefined"]:
        raise HTTPException(status_code=400, detail="Teléfono válido requerido")
        
    if phone in pending_validation_users_wa:
        pending_validation_users_wa.discard(phone)
        status = "active"
        msg = "Bot Reanudado"
    else:
        pending_validation_users_wa.add(phone)
        status = "paused"
        msg = "Bot Pausado"
        
    logger.info(f"⚙️ Estado del bot para {phone} cambiado desde el Panel Web: {status}")
    return JSONResponse(content={"status": status, "message": msg, "is_paused": phone in pending_validation_users_wa})

@app.post("/api/dashboard/toggle-attended")
async def toggle_dashboard_attended(request: Request):
    """Marca o desmarca un chat como 'Atendido', despausa bot y resuelve alerta de trabajador en 1 solo paso."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    if not phone or phone.lower() in ["none", "null", "undefined"]:
        raise HTTPException(status_code=400, detail="Teléfono válido requerido")
        
    if phone in attended_chats:
        attended_chats.discard(phone)
        is_attended = False
    else:
        attended_chats.add(phone)
        is_attended = True
        # Las 3 acciones en una sola llamada:
        requires_worker_chats.pop(phone, None)
        pending_validation_users_wa.discard(phone)
        unread_chats.discard(phone)
        unread_counts[phone] = 0
        
    save_chat_history()
    save_user_sessions()
    logger.info(f"📋 Chat {phone} marcado como Atendido: {is_attended} (alertas y pausa resueltas)")
    return JSONResponse(content={
        "status": "success", 
        "phone": phone, 
        "is_attended": is_attended, 
        "requires_worker": phone in requires_worker_chats, 
        "is_paused": phone in pending_validation_users_wa, 
        "is_unread": phone in unread_chats, 
        "unread_count": 0
    })

@app.post("/api/dashboard/toggle-unread")
async def toggle_dashboard_unread(request: Request):
    """Marca o desmarca un chat como 'No Leído' (punto verde y círculo con número de seguimiento)."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    if not phone or phone.lower() in ["none", "null", "undefined"]:
        raise HTTPException(status_code=400, detail="Teléfono válido requerido")
        
    if "is_unread" in data:
        is_unread = bool(data["is_unread"])
        if is_unread:
            unread_chats.add(phone)
            unread_counts[phone] = unread_counts.get(phone, 0) or 1
        else:
            unread_chats.discard(phone)
            unread_counts[phone] = 0
    else:
        if phone in unread_chats:
            unread_chats.discard(phone)
            unread_counts[phone] = 0
            is_unread = False
        else:
            unread_chats.add(phone)
            unread_counts[phone] = unread_counts.get(phone, 0) or 1
            is_unread = True
            
    save_chat_history()
    unread_c = unread_counts.get(phone, 0)
    logger.info(f"🟢 Chat {phone} marcado como No Leído: {is_unread} (conteo: {unread_c})")
    return JSONResponse(content={"status": "success", "phone": phone, "is_unread": is_unread, "unread_count": unread_c})

@app.post("/api/dashboard/toggle-alta-demanda")
async def toggle_alta_demanda_api(request: Request):
    """Activa o desactiva el Modo Alta Demanda desde el Panel Web."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    global alta_demanda_mode
    alta_demanda_mode = not alta_demanda_mode
    save_chat_history()
    logger.info(f"🔥 Modo Alta Demanda cambiado desde Panel Web a: {alta_demanda_mode}")
    return JSONResponse(content={"alta_demanda_mode": alta_demanda_mode, "tiempo_estimado": get_tiempo_estimado_str()})

@app.post("/api/dashboard/send-message")
async def send_dashboard_manual_message(request: Request):
    """Envía un mensaje manual de WhatsApp al cliente desde el Panel Web."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    text = str(data.get("text", "")).strip()
    
    if not phone or phone.lower() in ["none", "null", "undefined"] or not text:
        raise HTTPException(status_code=400, detail="Teléfono válido y texto requeridos")
        
    cmd_lower = text.strip().lower()
    if cmd_lower == "/listo":
        text = f"Gracias 🥰 \n\nEn un plazo aprox a {get_tiempo_estimado_str()} estará llegando su pedido 🙌🏻, por favor este atent@ que el Delivery le anticipará su llegada vía WhatsApp o llamada✌️🤗"
    elif cmd_lower == "/recojo":
        text = "Gracias 🥰\n\nSu pedido ha sido aceptado con éxito 🎉. Le avisaremos por aquí cuando su pedido esté listo para su recojo 🛍️✨. ¡Muchas gracias por su preferencia! 🙌🏻"
    elif cmd_lower == "/ubicacion":
        text = "Por favor, compártanos su ubicación actual directamente desde la función de adjuntar ubicación de WhatsApp (ícono de clip 📎 -> Ubicación) para poder calcular el costo de delivery exacto y su total final 🙏📍."
    elif cmd_lower == "/pago":
        text = "Aceptamos 🛡️\n\n✔️ Yape y Plin: 977503006\n✔️ A nombre de: María José Morillo Ruiz\n✔️ Tarjeta (Contra Entrega con POS 💳)\n✔️ Efectivo\n\nPor favor, envíenos la captura o foto de su comprobante de pago por aquí para validar su pedido 🥰."

    success, err_msg = await send_whatsapp_message_detailed(phone, text)
    if success:
        unread_chats.discard(phone)
        unread_counts[phone] = 0
        save_chat_history()
        log_chat_message(phone, "admin", "Admin (Panel Web) 👤", text)
        if phone in user_sessions:
            user_sessions[phone].append({
                "role": "assistant",
                "content": f"[Mensaje enviado por el Administrador al cliente]: {text}"
            })
        return JSONResponse(content={"status": "success", "message": "Mensaje enviado por WhatsApp."})
    else:
        raise HTTPException(status_code=400, detail=err_msg)

@app.post("/api/dashboard/send-image")
async def send_dashboard_manual_image(
    request: Request,
    phone: str = Form(...),
    caption: str = Form(""),
    file: UploadFile = File(...)
):
    """Envía una imagen manual de WhatsApp al cliente desde el Panel Web."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    clean_phone = str(phone).strip()
    if not clean_phone or clean_phone.lower() in ["none", "null", "undefined"]:
        raise HTTPException(status_code=400, detail="Teléfono válido requerido")
        
    os.makedirs("uploads", exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".jpg"
    if not ext or len(ext) > 5:
        ext = ".jpg"
    timestamp_name = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    saved_filename = f"upload_{timestamp_name}{ext}"
    local_path = os.path.join("uploads", saved_filename)
    
    file_bytes = await file.read()
    with open(local_path, "wb") as f:
        f.write(file_bytes)
        
    caption_text = str(caption or "").strip()
    success, err_msg = await send_whatsapp_image_detailed(clean_phone, local_path, caption=caption_text)
    if success:
        unread_chats.discard(clean_phone)
        unread_counts[clean_phone] = 0
        save_chat_history()
        log_chat_message(
            clean_phone,
            "admin",
            "Admin (Panel Web) 👤",
            caption_text or "[📸 Imagen enviada por el Administrador]",
            media_type="image",
            media_url=f"/uploads/{saved_filename}"
        )
        if clean_phone in user_sessions:
            user_sessions[clean_phone].append({
                "role": "assistant",
                "content": f"[El Administrador envió una imagen al cliente con texto]: {caption_text}" if caption_text else "[El Administrador envió una imagen al cliente]"
            })
        return JSONResponse(content={"status": "success", "message": "Imagen enviada por WhatsApp.", "media_url": f"/uploads/{saved_filename}"})
    else:
        raise HTTPException(status_code=400, detail=err_msg)

@app.post("/api/dashboard/delete-message")
async def delete_dashboard_message(request: Request):
    """Elimina un mensaje específico del historial de monitoreo en vivo."""
    if not is_admin_authenticated(request):
        raise HTTPException(status_code=401, detail="No autorizado")
        
    data = await request.json()
    phone = str(data.get("phone", "")).strip()
    msg_id = data.get("id")
    if not phone or msg_id is None:
        raise HTTPException(status_code=400, detail="Teléfono y ID de mensaje requeridos")
        
    if phone in chat_logs_history:
        orig_count = len(chat_logs_history[phone])
        chat_logs_history[phone] = [m for m in chat_logs_history[phone] if m.get("id") != msg_id]
        if len(chat_logs_history[phone]) < orig_count:
            save_chat_history()
            logger.info(f"🗑️ Mensaje ID {msg_id} de {phone} eliminado desde el Panel Web.")
            return JSONResponse(content={"status": "success", "message": "Mensaje eliminado del panel."})
    return JSONResponse(content={"status": "error", "message": "Mensaje no encontrado."})

def get_login_page_html() -> str:
    """Retorna la interfaz visual de inicio de sesión de Caprichos."""
    return """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script>
        window.onerror = function(msg, url, line, col, err) {
            console.error("Global JS Error:", msg, line, col, err);
            try {
                var banner = document.getElementById('debugErrorBanner');
                if (banner) {
                    banner.style.display = 'block';
                    banner.innerText = '⚠️ Error en panel [' + line + ':' + col + ']: ' + msg;
                }
                var cl = document.getElementById('chatList');
                if (cl && cl.innerHTML.indexOf('Cargando') !== -1) {
                    cl.innerHTML = '<div style="padding:16px; color:#ef4444; font-size:12px; font-family:monospace; background:#ef444415; border-radius:8px; margin:10px;">⚠️ Error de ejecución: ' + msg + ' (Línea ' + line + ')</div>';
                }
            } catch(e) {}
        };
        window.addEventListener('unhandledrejection', function(e) {
            console.error("Unhandled rejection:", e.reason);
        });
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar Sesión - Caprichos Panel 🍰☕</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body {
            background: radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-card {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 122, 0, 0.3);
            border-radius: 20px;
            padding: 36px 32px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45), 0 0 25px rgba(255, 122, 0, 0.15);
            animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .login-header {
            text-align: center;
            margin-bottom: 28px;
        }
        .brand-icon {
            font-size: 42px;
            margin-bottom: 8px;
            display: inline-block;
            filter: drop-shadow(0 4px 10px rgba(255, 122, 0, 0.3));
        }
        .login-title {
            font-size: 22px;
            font-weight: 700;
            color: #ff7a00;
            letter-spacing: -0.3px;
        }
        .login-subtitle {
            font-size: 13px;
            color: #94a3b8;
            margin-top: 4px;
        }
        .form-group {
            margin-bottom: 18px;
        }
        .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }
        .form-input {
            width: 100%;
            background: #0f172a;
            border: 1px solid #334155;
            color: white;
            padding: 13px 16px;
            border-radius: 10px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
        }
        .form-input:focus {
            border-color: #ff7a00;
            box-shadow: 0 0 0 3px rgba(255, 122, 0, 0.2);
        }
        .toggle-pwd {
            position: absolute;
            right: 12px;
            background: transparent;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
        }
        .toggle-pwd:hover { color: #f8fafc; }
        .error-msg {
            display: none;
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.35);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            margin-bottom: 18px;
            text-align: center;
        }
        .btn-login {
            width: 100%;
            background: linear-gradient(135deg, #ff7a00, #ea580c);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 14px rgba(255, 122, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .btn-login:hover {
            background: linear-gradient(135deg, #ff8c1a, #f97316);
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(255, 122, 0, 0.45);
        }
        .btn-login:disabled {
            background: #64748b;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .login-footer {
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div id="debugErrorBanner" style="display:none; background:#b91c1c; color:#fff; padding:10px 16px; font-size:13px; font-weight:600; text-align:center; z-index:99999;"></div>
    <div class="login-card">
        <div class="login-header">
            <div class="brand-icon">🍰☕</div>
            <h1 class="login-title">Caprichos Cafetería</h1>
            <p class="login-subtitle">Panel de Monitoreo WhatsApp</p>
        </div>
        
        <div class="error-msg" id="errorMsg">Usuario o contraseña incorrectos</div>
        
        <form id="loginForm" onsubmit="handleLogin(event)">
            <div class="form-group">
                <label class="form-label">Usuario</label>
                <input type="text" id="userInput" class="form-input" placeholder="Ingresa tu usuario" required autocomplete="username" autofocus>
            </div>
            
            <div class="form-group">
                <label class="form-label">Contraseña</label>
                <div class="input-wrapper">
                    <input type="password" id="pwdInput" class="form-input" placeholder="Ingresa tu contraseña" required autocomplete="current-password">
                    <button type="button" class="toggle-pwd" onclick="togglePwdVisibility()" id="btnTogglePwd" title="Ver / Ocultar">👁️</button>
                </div>
            </div>
            
            <button type="submit" class="btn-login" id="btnLogin">
                <span>Ingresar al Panel</span> 🔐
            </button>
        </form>
        
        <div class="login-footer">
            Caprichos Bot v2.0 • Acceso seguro restringido
        </div>
    </div>

    <script>
        function togglePwdVisibility() {
            const input = document.getElementById('pwdInput');
            const btn = document.getElementById('btnTogglePwd');
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerText = '🙈';
            } else {
                input.type = 'password';
                btn.innerText = '👁️';
            }
        }

        async function handleLogin(e) {
            e.preventDefault();
            const userInput = document.getElementById('userInput').value.trim();
            const pwdInput = document.getElementById('pwdInput').value;
            const errorMsg = document.getElementById('errorMsg');
            const btnLogin = document.getElementById('btnLogin');
            
            errorMsg.style.display = 'none';
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<span>Verificando...</span> ⏳';
            
            try {
                const res = await fetch('/api/dashboard/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInput, password: pwdInput })
                });
                
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    window.location.reload();
                } else {
                    errorMsg.innerText = data.message || 'Usuario o contraseña incorrectos';
                    errorMsg.style.display = 'block';
                    btnLogin.disabled = false;
                    btnLogin.innerHTML = '<span>Ingresar al Panel</span> 🔐';
                }
            } catch (err) {
                errorMsg.innerText = 'Error conectando con el servidor';
                errorMsg.style.display = 'block';
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<span>Ingresar al Panel</span> 🔐';
            }
        }
    </script>
</body>
</html>
"""

@app.get("/admin", response_class=HTMLResponse)
async def serve_admin_panel(request: Request):
    """Sirve la interfaz web interactiva de monitoreo o la pantalla de login si no está autenticado."""
    if not is_admin_authenticated(request):
        return HTMLResponse(content=get_login_page_html())
        
    html_content = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Caprichos - Panel de Monitoreo WhatsApp 🍰☕</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body { background-color: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; }
        
        header { background: #1e293b; border-bottom: 1px solid #334155; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 19px; font-weight: 700; color: #ff7a00; display: flex; align-items: center; gap: 10px; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .status-badge { background: #10b98120; color: #10b981; border: 1px solid #10b98140; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
        
        .btn-sound { background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
        .btn-sound.sound-on { background: #10b98120; color: #10b981; border-color: #10b98160; }
        .btn-sound.sound-off { background: #ef444420; color: #ef4444; border-color: #ef444460; }
        .btn-sound-test { background: #3b82f620; color: #60a5fa; border: 1px solid #3b82f640; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-sound-test:hover { background: #3b82f640; }
        
        .btn-alta-demanda { padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; border: 1px solid; transition: all 0.2s; }
        .alta-off { background: #334155; color: #94a3b8; border-color: #475569; }
        .alta-on { background: #ef444420; color: #ef4444; border-color: #ef444460; box-shadow: 0 0 10px #ef444440; }
        
        .main-container { flex: 1; display: flex; overflow: hidden; }
        
        /* Sidebar de Chats */
        .sidebar { width: 360px; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; }
        .sidebar-header { padding: 14px 16px; border-bottom: 1px solid #334155; font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
        
        /* Buscador en Sidebar */
        .search-container { padding: 10px 14px; background: #111827; border-bottom: 1px solid #334155; }
        .search-wrapper { position: relative; display: flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 6px 10px; transition: all 0.2s; }
        .search-wrapper:focus-within { border-color: #ff7a00; box-shadow: 0 0 8px rgba(255, 122, 0, 0.25); }
        .search-icon { font-size: 13px; color: #64748b; margin-right: 8px; user-select: none; }
        .search-input { flex: 1; background: transparent; border: none; color: #f8fafc; font-size: 13px; outline: none; width: 100%; }
        .search-input::placeholder { color: #64748b; font-size: 12.5px; }
        .btn-clear-search { background: transparent; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; padding: 2px 4px; border-radius: 50%; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
        .btn-clear-search:hover { color: #f8fafc; background: #334155; }

        .sidebar-filters { display: flex; background: #0f172a; padding: 6px 8px; gap: 4px; border-bottom: 1px solid #334155; overflow-x: auto; }
        .filter-tab { flex: 1; min-width: max-content; background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 6px 6px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: center; white-space: nowrap; }
        .filter-tab:hover { color: #f8fafc; background: #1e293b; }
        .filter-tab.active { background: #334155; color: #ff7a00; border-color: #ff7a0060; font-weight: 700; }
        
        .chat-list { flex: 1; overflow-y: auto; }
        
        .chat-item { padding: 12px 14px; border-bottom: 1px solid #334155; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; position: relative; }
        .chat-item:hover, .chat-item.active { background: #33415580; }
        .chat-item.active { border-left: 4px solid #ff7a00; }
        .chat-item.is-attended { opacity: 0.65; }
        .chat-item.is-attended:hover { opacity: 1; }
        
        /* Punto verde pulsante estilo WhatsApp para NO LEÍDOS */
        .chat-item.has-unread::before {
            content: '';
            position: absolute;
            left: 5px;
            top: 50%;
            transform: translateY(-50%);
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 10px #10b981, 0 0 4px #34d399;
            animation: pulse-green 1.4s infinite;
        }
        
        @keyframes pulse-green {
            0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
            50% { opacity: 0.35; transform: translateY(-50%) scale(1.35); }
        }
        
        .chat-info { flex: 1; min-width: 0; margin-right: 10px; }
        .chat-name { font-weight: 600; font-size: 14.5px; color: #f8fafc; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
        
        .chat-subline { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 3px; }
        .chat-phone-tag { font-family: monospace; color: #38bdf8; font-size: 11.5px; font-weight: 600; }
        .btn-quick-copy { background: #1e293b; border: 1px solid #475569; color: #94a3b8; border-radius: 4px; padding: 1px 5px; font-size: 10px; cursor: pointer; transition: all 0.15s; }
        .chat-item:hover .btn-quick-copy { color: #f8fafc; border-color: #60a5fa; background: #3b82f620; }
        .btn-quick-copy:hover { color: #60a5fa !important; border-color: #3b82f6 !important; transform: scale(1.15); }

        .chat-last-msg { font-size: 12.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .chat-meta { text-align: right; font-size: 11px; color: #64748b; }
        .badge-paused { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; margin-top: 4px; display: inline-block; }
        .badge-active { background: #10b98120; color: #10b981; border: 1px solid #10b98140; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; margin-top: 4px; display: inline-block; }
        .badge-attended { background: #3b82f620; color: #60a5fa; border: 1px solid #3b82f640; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; margin-top: 4px; display: inline-block; }
        
        /* Círculo verde con número de mensajes no leídos estilo WhatsApp */
        .unread-count-badge {
            background: #25d366;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            min-width: 20px;
            height: 20px;
            padding: 0 5px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.45);
            animation: popBadge 0.25s ease-out;
            letter-spacing: -0.2px;
            flex-shrink: 0;
        }
        @keyframes popBadge {
            0% { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes pulse-yellow {
            0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 10px rgba(250, 204, 21, 0.6); }
            50% { opacity: 0.85; transform: scale(1.03); box-shadow: 0 0 16px rgba(250, 204, 21, 0.9); }
        }
        .badge-worker { 
            background: #fef08a; 
            color: #854d0e; 
            border: 1px solid #facc15; 
            padding: 3px 8px; 
            border-radius: 6px; 
            font-size: 11px; 
            font-weight: 800; 
            animation: pulse-yellow 1.8s infinite; 
            display: inline-flex; 
            align-items: center; 
            gap: 4px;
            letter-spacing: 0.3px;
        }
        .chat-item.requires-worker {
            border-left: 4px solid #facc15 !important;
            background: rgba(234, 179, 8, 0.08);
        }
        .chat-item.requires-worker:hover {
            background: rgba(234, 179, 8, 0.14);
        }
        .worker-alert-banner {
            background: linear-gradient(90deg, #854d0e, #a16207);
            color: #fef08a;
            padding: 10px 24px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #facc1560;
        }
        .btn-resolve-worker {
            background: #facc15;
            color: #713f12;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-resolve-worker:hover {
            background: #fde047;
            transform: scale(1.02);
        }

        /* Panel Principal de Chat */
        .chat-panel { flex: 1; display: flex; flex-direction: column; background: #0f172a; }
        
        .chat-header { background: #1e293b; padding: 12px 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .active-user-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
        .active-user-sub { font-size: 12.5px; color: #94a3b8; display: flex; align-items: center; gap: 8px; margin-top: 3px; flex-wrap: wrap; }
        
        .phone-chip { background: #0f172a; color: #38bdf8; border: 1px solid #38bdf840; font-family: monospace; font-weight: 700; font-size: 12px; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
        .btn-action-phone { background: #3b82f620; color: #60a5fa; border: 1px solid #3b82f650; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .btn-action-phone:hover { background: #3b82f640; color: #93c5fd; border-color: #3b82f680; transform: translateY(-1px); }
        .btn-action-phone.copied { background: #10b98125 !important; color: #34d399 !important; border-color: #10b981 !important; }
        .btn-action-wa { background: #25d36620; color: #25d366; border: 1px solid #25d36650; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; text-decoration: none; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .btn-action-wa:hover { background: #25d36640; color: #4ade80; border-color: #25d36680; transform: translateY(-1px); }
        
        .btn-gps-link { background: #10b98120; color: #10b981; border: 1px solid #10b98140; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
        .btn-gps-link:hover { background: #10b98140; }
        
        .btn-toggle-unread { padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 12.5px; cursor: pointer; border: 1px solid; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
        .btn-unread-inactive { background: #334155; color: #cbd5e1; border-color: #475569; }
        .btn-unread-inactive:hover { background: #10b98120; color: #34d399; border-color: #10b98150; }
        .btn-unread-active { background: #10b98125; color: #34d399; border-color: #10b98180; font-weight: 700; box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); }
        .btn-unread-active:hover { background: #10b98140; }

        .btn-toggle-attended { padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 12.5px; cursor: pointer; border: 1px solid; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
        .btn-attended-no { background: #334155; color: #cbd5e1; border-color: #475569; }
        .btn-attended-no:hover { background: #3b82f620; color: #60a5fa; border-color: #3b82f660; }
        .btn-attended-yes { background: #3b82f620; color: #60a5fa; border-color: #3b82f680; font-weight: 700; }
        .btn-attended-yes:hover { background: #3b82f640; }
        
        .btn-toggle-pause { padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 12.5px; cursor: pointer; border: none; transition: background 0.2s; }
        .btn-pause { background: #ef4444; color: white; }
        .btn-pause:hover { background: #dc2626; }
        .btn-resume { background: #10b981; color: white; }
        .btn-resume:hover { background: #059669; }

        /* Botón de Acceso Rápido a Resumen de Pedido para POS */
        .btn-order-summary {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #ffffff;
            border: 1px solid #f59e0b80;
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 12.5px;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
        }
        .btn-order-summary:hover {
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
        }
        .btn-order-summary.has-new-order {
            animation: pulse-yellow 2s infinite;
        }

        /* Modal Ultraligero para Visualizar y Copiar Resumen de Pedido al POS */
        .summary-modal-backdrop {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(8px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 16px;
            animation: fadeInToast 0.2s ease-out;
        }
        .summary-modal-content {
            background: #1e293b;
            border: 1px solid #f59e0b60;
            border-radius: 16px;
            width: 100%;
            max-width: 580px;
            max-height: 88vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(245, 158, 11, 0.2);
            overflow: hidden;
        }
        .summary-modal-header {
            padding: 16px 20px;
            background: #0f172a;
            border-bottom: 1px solid #334155;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .summary-modal-title {
            font-size: 16px;
            font-weight: 700;
            color: #f8fafc;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-close-modal {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            line-height: 1;
            transition: all 0.15s;
        }
        .btn-close-modal:hover { color: #f8fafc; background: #334155; }
        .summary-modal-body {
            padding: 18px 20px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .summary-text-box {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 14px 16px;
            color: #f8fafc;
            font-size: 13.5px;
            line-height: 1.6;
            white-space: pre-wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            user-select: text;
            max-height: 380px;
            overflow-y: auto;
        }
        .summary-modal-actions {
            padding: 14px 20px;
            background: #0f172a;
            border-top: 1px solid #334155;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
        }
        .btn-copy-pos {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }
        .btn-copy-pos:hover {
            background: linear-gradient(135deg, #34d399, #10b981);
            transform: translateY(-1px);
        }
        .btn-copy-full {
            background: #334155;
            color: #f8fafc;
            border: 1px solid #475569;
            padding: 9px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-copy-full:hover {
            background: #475569;
            color: white;
        }
        
        .messages-container { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        
        /* Toast flotante para feedback de copia */
        #toastNotification {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid #10b981;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            display: none;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 10px rgba(16,185,129,0.3);
            z-index: 9999;
            animation: fadeInToast 0.3s ease-out;
        }
        @keyframes fadeInToast {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Separadores de Fecha estilo WhatsApp */
        .date-separator-container { display: flex; justify-content: center; align-items: center; margin: 16px 0 8px 0; width: 100%; }
        .date-separator-badge { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 5px 16px; border-radius: 12px; font-size: 12px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.3); text-transform: capitalize; }
        
        .message-bubble { max-width: 65%; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; position: relative; }
        .msg-client { align-self: flex-start; background: #334155; color: #f8fafc; border-bottom-left-radius: 2px; }
        .msg-bot { align-self: flex-end; background: #ff7a00; color: white; border-bottom-right-radius: 2px; }
        .msg-admin { align-self: flex-end; background: #3b82f6; color: white; border-bottom-right-radius: 2px; }
        
        .msg-meta { font-size: 10px; margin-top: 6px; opacity: 0.85; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
        .msg-sender { font-weight: 700; font-size: 11px; margin-bottom: 4px; opacity: 0.9; }
        
        .btn-delete-msg { background: transparent; border: none; cursor: pointer; font-size: 11px; opacity: 0.2; padding: 0 2px; transition: all 0.15s; }
        .message-bubble:hover .btn-delete-msg { opacity: 0.85; }
        .btn-delete-msg:hover { opacity: 1; transform: scale(1.3); }
        
        /* Media & Map Card */
        .msg-image { max-width: 260px; border-radius: 8px; margin-top: 8px; border: 1px solid #475569; display: block; cursor: pointer; }
        .msg-location-card { margin-top: 8px; background: #0f172a60; padding: 8px 12px; border-radius: 8px; border: 1px solid #334155; }
        .msg-location-btn { background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; }
        .msg-location-btn:hover { background: #059669; }
        
        /* Input & Controls */
        .chat-input-area { padding: 14px 24px; background: #1e293b; border-top: 1px solid #334155; display: flex; flex-direction: column; gap: 10px; }
        
        .quick-replies-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .quick-replies-label { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-right: 4px; }
        .btn-quick { background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-quick:hover { background: #ff7a00; color: white; border-color: #ff7a00; }
        
        .emoji-bar { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px; align-items: center; }
        .btn-emoji { background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: background 0.15s; }
        .btn-emoji:hover { background: #334155; transform: scale(1.2); }
        
        /* Preview de Imagen */
        .image-preview-card { display: flex; align-items: center; gap: 12px; background: #0f172a; border: 1px solid #ff7a00; padding: 8px 12px; border-radius: 8px; }
        .image-preview-card img { width: 46px; height: 46px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; }
        .image-preview-text { flex: 1; min-width: 0; }
        .image-preview-name { font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .image-preview-hint { font-size: 11px; color: #ff7a00; }
        .btn-cancel-preview { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-cancel-preview:hover { background: #ef4444; color: white; }
        
        .input-row { display: flex; gap: 10px; align-items: center; }
        .btn-attach { background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 12px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .btn-attach:hover { background: #475569; border-color: #ff7a00; color: #ff7a00; }
        
        .chat-input { flex: 1; background: #0f172a; border: 1px solid #334155; color: white; padding: 12px 16px; border-radius: 8px; font-size: 14px; outline: none; }
        .chat-input:focus { border-color: #ff7a00; }
        .btn-send { background: #ff7a00; color: white; border: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .btn-send:hover { background: #e66e00; }
        .btn-send:disabled { background: #64748b; cursor: not-allowed; }
        
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; font-size: 16px; text-align: center; padding: 20px; }

        .logo-short { display: none; }
        .btn-send-icon { display: none; }
        .btn-attach-icon { display: none; }
        .btn-back-sidebar { display: none; background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; align-items: center; gap: 6px; transition: all 0.2s; white-space: nowrap; }
        .btn-back-sidebar:hover { background: #ff7a00; color: white; border-color: #ff7a00; }

        /* Responsive Mobile & Tablet */
        @media (max-width: 768px) {
            header { padding: 10px 14px; flex-wrap: wrap; gap: 8px; }
            .logo { font-size: 15px; }
            .logo-full { display: none; }
            .logo-short { display: inline; }
            .header-actions { gap: 6px; flex-wrap: wrap; width: 100%; justify-content: space-between; }
            .btn-sound, .btn-alta-demanda, .status-badge, .btn-sound-test { padding: 5px 8px; font-size: 11px; }
            
            .main-container { position: relative; }
            .sidebar { width: 100%; flex: 1; display: flex; }
            .chat-panel { display: none; width: 100%; flex: 1; }
            
            /* Cuando un chat está seleccionado en móvil */
            .main-container.mobile-chat-open .sidebar { display: none !important; }
            .main-container.mobile-chat-open .chat-panel { display: flex !important; }
            
            .btn-back-sidebar { display: inline-flex !important; }
            .chat-header { padding: 10px 14px; gap: 8px; }
            .active-user-title { font-size: 15px; }
            .active-user-sub { font-size: 11px; }
            .btn-toggle-attended, .btn-toggle-pause, .btn-toggle-unread { padding: 6px 10px; font-size: 11px; }
            
            .messages-container { padding: 12px 10px; gap: 8px; }
            .message-bubble { max-width: 88%; padding: 10px 12px; font-size: 13.5px; }
            .msg-image { max-width: 100%; }
            
            .chat-input-area { padding: 10px 12px; gap: 8px; }
            .quick-replies-bar { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; }
            .quick-replies-label { white-space: nowrap; }
            
            .btn-attach-text { display: none; }
            .btn-attach-icon { display: inline; font-size: 16px; }
            .btn-attach { padding: 10px 12px; }
            
            .btn-send-text { display: none; }
            .btn-send-icon { display: inline; font-size: 16px; }
            .btn-send { padding: 10px 16px; }
            
            .chat-input { padding: 10px 12px; font-size: 13.5px; }
            
            .worker-alert-banner { padding: 8px 12px; font-size: 12px; flex-direction: column; align-items: flex-start; gap: 6px; }
            .btn-resolve-worker { align-self: flex-end; padding: 5px 10px; }
            .btn-sound, .btn-alta-demanda, .status-badge, .btn-sound-test, .btn-logout { padding: 5px 8px; font-size: 11px; }
        }

        .btn-logout { background: #ef444420; color: #f87171; border: 1px solid #ef444450; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .btn-logout:hover { background: #ef4444; color: white; }

        @media (min-width: 769px) and (max-width: 1024px) {
            .sidebar { width: 300px; }
            header { padding: 12px 18px; }
            .chat-header { padding: 12px 18px; }
            .message-bubble { max-width: 75%; }
        }
    </style>
</head>
<body>
    <header>
        <div class="logo">🍰☕ <span class="logo-full">Caprichos - Panel de Monitoreo WhatsApp</span><span class="logo-short">Caprichos Panel</span></div>
        <div class="header-actions">
            <button class="btn-sound sound-on" id="btnSoundToggle" onclick="toggleSound()" title="Activar/Silenciar sonido de nuevos mensajes">🔔 Sonido: ON</button>
            <button class="btn-sound-test" onclick="playChimeSound(true)" title="Probar sonido y desbloquear audio del navegador">🔊 Probar</button>
            <button class="btn-alta-demanda alta-off" id="btnAltaDemanda" onclick="toggleAltaDemanda()">🔥 Alta Demanda: OFF (30-45m)</button>
            <div class="status-badge">🟢 Online</div>
            <button class="btn-logout" onclick="logoutAdmin()" title="Cerrar Sesión del Panel">🚪 Salir</button>
        </div>
    </header>
    
    <div class="main-container">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="sidebar-header">
                <span>Conversaciones</span>
                <span id="chatCountBadge" style="font-size: 11px; background: #334155; padding: 2px 8px; border-radius: 10px; color: #94a3b8;">0</span>
            </div>
            <!-- Buscador en Vivo -->
            <div class="search-container">
                <div class="search-wrapper">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="chatSearchInput" class="search-input" placeholder="Buscar por nombre, celular o mensaje..." oninput="handleSearch(this.value)" autocomplete="off">
                    <button id="btnClearSearch" class="btn-clear-search" onclick="clearSearch()" style="display:none;" title="Limpiar búsqueda">✖</button>
                </div>
            </div>
            <!-- Filtros de Pestañas (3 categorías principales) -->
            <div class="sidebar-filters">
                <button class="filter-tab" id="tabWorker" onclick="setFilter('worker')">🔴 Requiere Atención (<span id="countWorker">0</span>)</button>
                <button class="filter-tab" id="tabToday" onclick="setFilter('today')">🟢 Hoy (<span id="countToday">0</span>)</button>
                <button class="filter-tab active" id="tabAll" onclick="setFilter('all')">📁 Todos (<span id="countAll">0</span>)</button>
            </div>
            <div class="chat-list" id="chatList">
                <div style="padding: 24px 16px; color: #94a3b8; text-align: center; font-size: 13px;">⏳ Cargando conversaciones...</div>
            </div>
        </div>
        
        <!-- Panel de Chat -->
        <div class="chat-panel" id="chatPanel">
            <div class="empty-state" id="emptyState">
                <div style="font-size: 40px; margin-bottom: 12px;">💬</div>
                <div>Selecciona una conversación de la izquierda para supervisarla en vivo.</div>
                <div style="font-size: 13px; color: #475569; margin-top: 8px;">El sistema emitirá un sonido 🔔 cuando ingrese un nuevo mensaje de un cliente.</div>
            </div>
            
            <div style="display: none; flex-direction: column; height: 100%;" id="activeChatView">
                <!-- Banner de Alerta Requiere Trabajador -->
                <div id="workerAlertBanner" style="display:none;" class="worker-alert-banner">
                    <div>
                        <span>🟡 <b>REQUIERE ATENCIÓN DE UN TRABAJADOR:</b> <span id="workerReasonText">Pedido por atender</span></span>
                    </div>
                </div>

                <div class="chat-header">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <button class="btn-back-sidebar" id="btnBackSidebar" onclick="closeChatMobile()" title="Volver a la lista de chats">⬅ Volver</button>
                        <div style="min-width: 0;">
                            <div class="active-user-title" id="activeUserName">Cliente</div>
                            <div class="active-user-sub">
                                <span class="phone-chip" id="activeUserPhoneChip">📱 Cargando...</span>
                                <button class="btn-action-phone" id="btnCopyPhone" onclick="copyCurrentPhone()" title="Copiar celular de 9 dígitos para ubicar en el WhatsApp Business 977503006">📋 Copiar Celular</button>
                                <a class="btn-action-wa" id="btnOpenWa" href="#" target="_blank" title="Abrir chat en WhatsApp">💬 Abrir en WhatsApp</a>
                                <a id="activeUserGpsLink" href="#" target="_blank" style="display:none;" class="btn-gps-link">📍 Ver GPS</a>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
                        <button class="btn-order-summary" id="btnOrderSummary" onclick="openOrderSummaryModal()" title="Visualizar el último resumen del pedido para copiar los productos a tu punto de venta (POS)">📋 Ver Resumen Pedido</button>
                        <button class="btn-toggle-unread btn-unread-inactive" id="btnToggleUnread" onclick="toggleUnread()" title="Marcar como no leído para tener pendiente el chat y darle seguimiento oportuno">🟢 Marcar No Leído</button>
                        <button class="btn-toggle-attended btn-attended-no" id="btnToggleAttended" onclick="toggleAttended()" title="Mover a carpeta de Atendidos">⚪ Marcar Atendido</button>
                        <button class="btn-toggle-pause btn-pause" id="btnTogglePause" onclick="togglePause()">⏸️ Pausar Bot</button>
                    </div>
                </div>
                
                <div class="messages-container" id="messagesContainer">
                    <!-- Burbujas de mensajes con separadores de fecha -->
                </div>
                
                <div class="chat-input-area">
                    <!-- Barra de Respuestas Rápidas -->
                    <div class="quick-replies-bar">
                        <span class="quick-replies-label">Respuestas Rápidas:</span>
                        <button class="btn-quick" onclick="insertQuickReply('/listo')">⚡ /listo</button>
                        <button class="btn-quick" onclick="insertQuickReply('/recojo')">🛍️ /recojo</button>
                        <button class="btn-quick" onclick="insertQuickReply('/ubicacion')">📍 /ubicacion</button>
                        <button class="btn-quick" onclick="insertQuickReply('/pago')">💳 /pago</button>
                    </div>
                    
                    <!-- Barra de Emojis -->
                    <div class="emoji-bar">
                        <span class="quick-replies-label">Emojis:</span>
                        <button class="btn-emoji" onclick="addEmoji('🥰')">🥰</button>
                        <button class="btn-emoji" onclick="addEmoji('🛵')">🛵</button>
                        <button class="btn-emoji" onclick="addEmoji('☕')">☕</button>
                        <button class="btn-emoji" onclick="addEmoji('🍹')">🍹</button>
                        <button class="btn-emoji" onclick="addEmoji('🍩')">🍩</button>
                        <button class="btn-emoji" onclick="addEmoji('🍰')">🍰</button>
                        <button class="btn-emoji" onclick="addEmoji('🛍️')">🛍️</button>
                        <button class="btn-emoji" onclick="addEmoji('💳')">💳</button>
                        <button class="btn-emoji" onclick="addEmoji('📋')">📋</button>
                        <button class="btn-emoji" onclick="addEmoji('🙌🏻')">🙌🏻</button>
                        <button class="btn-emoji" onclick="addEmoji('✌️')">✌️</button>
                        <button class="btn-emoji" onclick="addEmoji('🤗')">🤗</button>
                        <button class="btn-emoji" onclick="addEmoji('⚡')">⚡</button>
                        <button class="btn-emoji" onclick="addEmoji('👋')">👋</button>
                        <button class="btn-emoji" onclick="addEmoji('👩‍💻')">👩‍💻</button>
                        <button class="btn-emoji" onclick="addEmoji('🧡')">🧡</button>
                        <button class="btn-emoji" onclick="addEmoji('📝')">📝</button>
                        <button class="btn-emoji" onclick="addEmoji('✨')">✨</button>
                        <button class="btn-emoji" onclick="addEmoji('🍔')">🍔</button>
                        <button class="btn-emoji" onclick="addEmoji('📍')">📍</button>
                        <button class="btn-emoji" onclick="addEmoji('⏳')">⏳</button>
                        <span style="font-size: 11px; color: #94a3b8; margin-left: 10px; white-space: nowrap; font-style: italic;">Para más emojis usa <b>Win + .</b> (Windows) o <b>Cmd + Ctrl + Espacio</b> (Mac)</span>
                    </div>
                    
                    <!-- Preview de Imagen Adjunta -->
                    <div id="imagePreviewContainer" style="display:none;" class="image-preview-card">
                        <img id="imagePreviewImg" src="" alt="Preview">
                        <div class="image-preview-text">
                            <div class="image-preview-name" id="imagePreviewFileName">imagen.jpg</div>
                            <div class="image-preview-hint">📸 Imagen adjunta lista para enviar (puedes agregar un texto o pie de foto)</div>
                        </div>
                        <button type="button" class="btn-cancel-preview" onclick="clearSelectedImage()">✖️ Quitar</button>
                    </div>
                    
                    <div class="input-row">
                        <input type="file" id="imageFileInput" accept="image/*" style="display:none;" onchange="handleImageSelected(event)">
                        <button type="button" class="btn-attach" onclick="document.getElementById('imageFileInput').click()" title="Adjuntar foto">
                            <span class="btn-attach-text">📷 Subir Foto</span>
                            <span class="btn-attach-icon">📷</span>
                        </button>
                        <textarea class="chat-input" id="messageInput" rows="1" placeholder="Escribe un mensaje o pie de foto (o pega una captura con Ctrl+V)..." style="resize:none; min-height:42px; max-height:120px; line-height:1.4;"></textarea>
                        <button class="btn-send" id="btnSendMessage" onclick="sendMessage()">
                            <span class="btn-send-text">Enviar por WhatsApp</span>
                            <span class="btn-send-icon">➤</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    <!-- Modal Ultraligero para Visualizar y Copiar Resumen de Pedido al POS -->
    <div id="summaryModalBackdrop" class="summary-modal-backdrop" onclick="closeOrderSummaryModal(event)">
        <div class="summary-modal-content" onclick="event.stopPropagation()">
            <div class="summary-modal-header">
                <div class="summary-modal-title">
                    <span>📋</span>
                    <span>Último Resumen del Pedido</span>
                    <span id="summaryModalClientTag" style="font-size: 12px; color: #94a3b8; font-weight: normal; margin-left: 6px;"></span>
                </div>
                <button class="btn-close-modal" onclick="closeOrderSummaryModal()" title="Cerrar ventana">✖</button>
            </div>
            <div class="summary-modal-body">
                <div style="font-size: 12.5px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
                    <span>🧾 Copia rápidamente los productos para ingresarlos en tu <b>Punto de Venta (POS)</b>:</span>
                </div>
                <div id="summaryTextBox" class="summary-text-box">Cargando resumen del pedido...</div>
            </div>
            <div class="summary-modal-actions">
                <button class="btn-copy-pos" onclick="copyOnlyProductsForPos()" title="Copia únicamente la lista de productos y cantidades para el POS">📋 Copiar Solo Productos (POS)</button>
                <button class="btn-copy-full" onclick="copyFullOrderSummary()" title="Copia el resumen completo (Nombre, teléfono, dirección, productos y total)">📑 Copiar Todo</button>
                <button class="btn-copy-full" style="background:#10b98125; color:#34d399; border-color:#10b981;" onclick="markAttendedFromModal()" title="Marcar como atendido y cerrar">✅ Marcar Atendido</button>
            </div>
        </div>
    </div>

    <!-- Toast flotante para feedback de copia -->
    <div id="toastNotification">📋 ¡Número copiado! Pégalo en el WhatsApp Business 977 503 006</div>

    <script>
        let currentPhone = null;
        let isCurrentPaused = false;
        let isCurrentAttended = false;
        let isCurrentUnread = false;
        let isCurrentRequiresWorker = false;
        let isAltaDemanda = false;
        let selectedImageFile = null;
        let currentFilter = 'all'; // 'all', 'worker', 'today'
        let searchQuery = '';
        let allChatsData = [];
        let currentOrderSummaryText = "";
        let lastRenderedListSig = "";
        let displayedChatsLimit = 60;
        let lastRenderedPhone = null;
        let lastRenderedMsgCount = -1;
        let lastRenderedLastMsgId = null;
        
        // Modal de Resumen de Pedido para POS
        function openOrderSummaryModal() {
            if (!currentPhone) return;
            const modal = document.getElementById('summaryModalBackdrop');
            const textBox = document.getElementById('summaryTextBox');
            const clientTag = document.getElementById('summaryModalClientTag');
            const chatObj = allChatsData.find(c => c.phone === currentPhone);
            const clientName = chatObj ? chatObj.name : currentPhone;
            
            if (clientTag) clientTag.innerText = `(${escapeHtml(clientName)} - ${getNationalPhone(currentPhone)})`;
            
            if (currentOrderSummaryText && currentOrderSummaryText.trim()) {
                textBox.innerText = currentOrderSummaryText;
            } else {
                textBox.innerText = "⏳ Consultando o generando resumen del pedido...";
                fetch(`/api/dashboard/order-summary/${currentPhone}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.summary && data.summary.trim()) {
                            currentOrderSummaryText = data.summary;
                            textBox.innerText = data.summary;
                        } else {
                            fetch('/api/dashboard/generate-summary', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phone: currentPhone })
                            })
                            .then(r => r.json())
                            .then(d => {
                                if (d.summary) {
                                    currentOrderSummaryText = d.summary;
                                    textBox.innerText = d.summary;
                                } else {
                                    textBox.innerText = "No se pudo generar un resumen formal para este chat aún.";
                                }
                            })
                            .catch(() => {
                                textBox.innerText = "Aún no hay un resumen formal registrado para este pedido.";
                            });
                        }
                    })
                    .catch(() => {
                        textBox.innerText = "Error de conexión al obtener el resumen.";
                    });
            }
            modal.style.display = 'flex';
        }

        function closeOrderSummaryModal(e = null) {
            const modal = document.getElementById('summaryModalBackdrop');
            if (modal) modal.style.display = 'none';
        }

        function copyOnlyProductsForPos() {
            if (!currentOrderSummaryText) {
                showToast("⚠️ No hay resumen disponible para copiar.");
                return;
            }
            const lines = (currentOrderSummaryText || '').split(String.fromCharCode(10));
            const productLines = [];
            let inPedidoSection = false;
            for (const line of lines) {
                const trimmed = line.trim();
                const lower = trimmed.toLowerCase();
                if (lower.startsWith('pedido:') || lower.startsWith('productos:')) {
                    inPedidoSection = true;
                    continue;
                }
                if (inPedidoSection) {
                    if (lower.startsWith('total:') || lower.startsWith('forma de pago:') || lower.startsWith('ubicaci') || lower.startsWith('n° de operaci') || lower.startsWith('fecha/hora')) {
                        inPedidoSection = false;
                        break;
                    }
                    if (trimmed.startsWith('-') || trimmed.startsWith('•') || /^\\d+[xX]/.test(trimmed)) {
                        productLines.push(trimmed.replace(/^[-•]\\s*/, ''));
                    }
                }
            }
            
            let textToCopy = "";
            if (productLines.length > 0) {
                textToCopy = productLines.join(String.fromCharCode(10));
            } else {
                const fallbackLines = lines.filter(l => l.trim().startsWith('-') || /^\\s*\\d+[xX]/.test(l.trim()));
                textToCopy = fallbackLines.length > 0 ? fallbackLines.map(l => l.trim().replace(/^[-•]\\s*/, '')).join(String.fromCharCode(10)) : currentOrderSummaryText;
            }
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast("✅ ¡Productos copiados! Listos para ingresar a tu Punto de Venta (POS).");
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = textToCopy;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast("✅ ¡Productos copiados! Listos para ingresar a tu Punto de Venta (POS).");
            });
        }

        function copyFullOrderSummary() {
            if (!currentOrderSummaryText) {
                showToast("⚠️ No hay resumen disponible para copiar.");
                return;
            }
            navigator.clipboard.writeText(currentOrderSummaryText).then(() => {
                showToast("📑 ¡Resumen completo copiado al portapapeles!");
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = currentOrderSummaryText;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast("📑 ¡Resumen completo copiado al portapapeles!");
            });
        }

        async function markAttendedFromModal() {
            closeOrderSummaryModal();
            if (currentPhone && !isCurrentAttended) {
                await toggleAttended();
            }
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeOrderSummaryModal();
            }
        });

        // Formateador de Celular Peruano
        function getNationalPhone(phone) {
            if (!phone) return '';
            const clean = ('' + phone).replace(/[^0-9]/g, '');
            return (clean.startsWith('51') && clean.length === 11) ? clean.substring(2) : clean;
        }

        function formatPhone(phone) {
            if (!phone) return '';
            const nat = getNationalPhone(phone);
            if (nat.length === 9) {
                return `${nat.substring(0,3)} ${nat.substring(3,6)} ${nat.substring(6)}`;
            }
            return phone;
        }

        // Sanitizador de texto HTML para evitar inyección y rotura de tags
        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // Feedback Toast
        function showToast(msg) {
            const toast = document.getElementById('toastNotification');
            if (!toast) return;
            toast.innerText = msg;
            toast.style.display = 'flex';
            clearTimeout(window._toastTimer);
            window._toastTimer = setTimeout(() => {
                toast.style.display = 'none';
            }, 2500);
        }

        // Copiar celular nacional al portapapeles para WhatsApp Business 977503006
        async function copyCustomerPhone(phoneStr) {
            const nat = getNationalPhone(phoneStr);
            if (!nat) return;
            try {
                await navigator.clipboard.writeText(nat);
                showToast(`📋 Celular ${formatPhone(nat)} copiado. ¡Listo para pegar en WhatsApp 977503006!`);
                const btn = document.getElementById('btnCopyPhone');
                if (btn && currentPhone && getNationalPhone(currentPhone) === nat) {
                    const orig = btn.innerHTML;
                    btn.classList.add('copied');
                    btn.innerHTML = '✅ ¡Copiado!';
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.innerHTML = orig;
                    }, 1800);
                }
            } catch (e) {
                const ta = document.createElement('textarea');
                ta.value = nat;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showToast(`📋 Celular ${formatPhone(nat)} copiado. ¡Listo para pegar en WhatsApp 977503006!`);
            }
        }

        function copyCurrentPhone() {
            copyCustomerPhone(currentPhone);
        }

        // Buscador de Chats en Vivo
        function handleSearch(val) {
            searchQuery = (val || '').trim().toLowerCase();
            const btnClear = document.getElementById('btnClearSearch');
            if (btnClear) {
                btnClear.style.display = searchQuery ? 'inline-flex' : 'none';
            }
            renderChatList(allChatsData);
        }

        function clearSearch() {
            const inp = document.getElementById('chatSearchInput');
            if (inp) inp.value = '';
            handleSearch('');
            if (inp) inp.focus();
        }

        // Sistema de Sonido y Notificaciones
        let audioCtx = null;
        let soundEnabled = true;
        try {
            soundEnabled = localStorage.getItem('caprichos_sound') !== 'false';
        } catch(e) {
            console.warn("Storage warning:", e);
        }
        let knownMessageCounts = {};
        let knownWorkerAlerts = new Set();
        let isInitialLoad = true;
        let originalPageTitle = document.title;
        let unreadCount = 0;
        
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }
        
        function playChimeSound(force = false) {
            if (!force && !soundEnabled) return;
            try {
                initAudio();
                const now = audioCtx.currentTime;
                
                // Nota 1: D5 (587.33 Hz)
                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(587.33, now);
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc1.connect(gain1);
                gain1.connect(audioCtx.destination);
                osc1.start(now);
                osc1.stop(now + 0.35);
                
                // Nota 2: A5 (880.00 Hz)
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880.00, now + 0.12);
                gain2.gain.setValueAtTime(0.35, now + 0.12);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start(now + 0.12);
                osc2.stop(now + 0.6);
            } catch (e) {
                console.warn("No se pudo reproducir el sonido:", e);
            }
        }
        
        function updateSoundButton() {
            const btn = document.getElementById('btnSoundToggle');
            if (soundEnabled) {
                btn.innerText = '🔔 Sonido: ON';
                btn.className = 'btn-sound sound-on';
            } else {
                btn.innerText = '🔕 Sonido: OFF';
                btn.className = 'btn-sound sound-off';
            }
        }
        
        function toggleSound() {
            initAudio();
            soundEnabled = !soundEnabled;
            try { localStorage.setItem('caprichos_sound', soundEnabled); } catch(e) {}
            updateSoundButton();
            if (soundEnabled) {
                playChimeSound(true);
                requestBrowserNotifications();
            }
        }
        
        function requestBrowserNotifications() {
            if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission();
            }
        }
        
        function showBrowserNotification(title, body) {
            if ("Notification" in window && Notification.permission === "granted") {
                try {
                    new Notification(title, {
                        body: body,
                        icon: "https://emojicdn.elk.sh/🍰",
                    });
                } catch (e) {}
            }
        }
        
        window.addEventListener('click', () => { initAudio(); requestBrowserNotifications(); }, { once: true });
        window.addEventListener('touchstart', () => { initAudio(); }, { once: true });
        window.addEventListener('focus', () => {
            unreadCount = 0;
            document.title = originalPageTitle;
        });
        
        updateSoundButton();
        
        function setFilter(filter) {
            currentFilter = filter; lastRenderedListSig = ''; displayedChatsLimit = 60;
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            if (filter === 'all') document.getElementById('tabAll').classList.add('active');
            if (filter === 'worker') document.getElementById('tabWorker').classList.add('active');
            if (filter === 'today') document.getElementById('tabToday').classList.add('active');
            renderChatList(allChatsData);
        }
        
        function updateAttendedButton(isAttended) {
            const btn = document.getElementById('btnToggleAttended');
            if (!btn) return;
            if (isAttended) {
                btn.innerText = '✅ Atendido';
                btn.className = 'btn-toggle-attended btn-attended-yes';
                btn.title = 'Hacer clic para desmarcar de Atendidos';
            } else {
                btn.innerText = '⚪ Marcar Atendido';
                btn.className = 'btn-toggle-attended btn-attended-no';
                btn.title = 'Mover pedido a la carpeta de Atendidos';
            }
        }
        
        async function toggleAttended() {
            if (!currentPhone) return;
            try {
                const res = await fetch('/api/dashboard/toggle-attended', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                const data = await res.json();
                isCurrentAttended = data.is_attended;
                updateAttendedButton(data.is_attended);
                if (data.is_attended) {
                    isCurrentUnread = false;
                    updateUnreadButton(false);
                    // Ocultar banner de alerta y marcar bot activo
                    const banner = document.getElementById('workerAlertBanner');
                    if (banner) banner.style.display = 'none';
                    isCurrentPaused = false;
                    updatePauseButton(false);
                }
                fetchChats();
            } catch (err) {
                alert("Error cambiando estado de atendido");
            }
        }

        function updateUnreadButton(isUnread) {
            const btn = document.getElementById('btnToggleUnread');
            if (!btn) return;
            if (isUnread) {
                btn.innerText = '🔘 Marcar Leído';
                btn.className = 'btn-toggle-unread btn-unread-active';
                btn.title = 'Hacer clic para marcar como leído (quitar punto verde)';
            } else {
                btn.innerText = '🟢 Marcar No Leído';
                btn.className = 'btn-toggle-unread btn-unread-inactive';
                btn.title = 'Marcar como no leído para tener pendiente el chat (poner punto verde)';
            }
        }

        async function toggleUnread(phone = null) {
            const targetPhone = phone || currentPhone;
            if (!targetPhone) return;
            try {
                const res = await fetch('/api/dashboard/toggle-unread', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: targetPhone })
                });
                const data = await res.json();
                if (targetPhone === currentPhone) {
                    isCurrentUnread = data.is_unread;
                    updateUnreadButton(isCurrentUnread);
                }
                const chatObj = allChatsData.find(c => c.phone === targetPhone);
                if (chatObj) {
                    chatObj.is_unread = data.is_unread;
                    chatObj.unread_count = data.unread_count || (data.is_unread ? 1 : 0);
                    renderChatList(allChatsData);
                }
                fetchChats();
            } catch (err) {
                alert("Error cambiando estado de lectura");
            }
        }

        async function resolveWorkerAttention() {
            if (!currentPhone) return;
            try {
                const res = await fetch('/api/dashboard/resolve-worker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone, mark_attended: true, unpause: false })
                });
                const data = await res.json();
                document.getElementById('workerAlertBanner').style.display = 'none';
                updateAttendedButton(true);
                updateUnreadButton(false);
                fetchChats();
            } catch (err) {
                alert("Error resolviendo alerta de trabajador");
            }
        }
        
        async function logoutAdmin() {
            if (!confirm("¿Deseas cerrar tu sesión del panel?")) return;
            try {
                await fetch('/api/dashboard/logout', { method: 'POST' });
            } catch (e) {}
            window.location.reload();
        }

        async function fetchChats() {
            try {
                const res = await fetch('/api/dashboard/chats');
                if (res.status === 401) {
                    window.location.reload();
                    return;
                }
                const data = await res.json();
                isAltaDemanda = data.alta_demanda_mode;
                updateAltaDemandaButton(isAltaDemanda, data.tiempo_estimado);
                
                // Detección de nuevos mensajes y alertas de trabajador
                let hasNewMessage = false;
                let hasNewWorkerAlert = false;
                let lastNewSender = "";
                let lastNewText = "";
                
                if (data.chats && data.chats.length > 0) {
                    for (const chat of data.chats) {
                        const prevCount = knownMessageCounts[chat.phone];
                        if (prevCount !== undefined && chat.message_count > prevCount) {
                            hasNewMessage = true;
                            lastNewSender = chat.name;
                            lastNewText = chat.last_message;
                            // Sonido inmediato en cada mensaje entrante de cliente
                            if (chat.last_sender === 'client') {
                                playChimeSound();
                            }
                        }
                        knownMessageCounts[chat.phone] = chat.message_count;

                        if (chat.requires_worker && !knownWorkerAlerts.has(chat.phone)) {
                            hasNewWorkerAlert = true;
                            knownWorkerAlerts.add(chat.phone);
                        } else if (!chat.requires_worker) {
                            knownWorkerAlerts.delete(chat.phone);
                        }
                    }
                }
                
                if (!isInitialLoad && (hasNewMessage || hasNewWorkerAlert)) {
                    playChimeSound();
                    unreadCount++;
                    if (hasNewWorkerAlert) {
                        document.title = `(⚠️) 🟡 ¡Requiere Trabajador! - Caprichos Panel`;
                        showBrowserNotification(`🟡 ¡Atención Requerida!`, `${lastNewSender || 'Cliente'} necesita la atención de un trabajador.`);
                    } else {
                        document.title = `(${unreadCount}) 💬 ¡Nuevo Mensaje! - Caprichos Panel`;
                        showBrowserNotification(`💬 ${lastNewSender}`, lastNewText);
                    }
                }
                
                isInitialLoad = false;
                renderChatList(data.chats);
                
                if (currentPhone) {
                    fetchMessages(currentPhone, false);
                }
            } catch (err) {
                console.error("Error cargando chats:", err);
            }
        }
        
        function updateAltaDemandaButton(active, tiempo) {
            const btn = document.getElementById('btnAltaDemanda');
            if (active) {
                btn.innerText = `🔥 Alta Demanda: ON (${tiempo})`;
                btn.className = 'btn-alta-demanda alta-on';
            } else {
                btn.innerText = `🔥 Alta Demanda: OFF (${tiempo})`;
                btn.className = 'btn-alta-demanda alta-off';
            }
        }
        
        async function toggleAltaDemanda() {
            try {
                const res = await fetch('/api/dashboard/toggle-alta-demanda', { method: 'POST' });
                const data = await res.json();
                isAltaDemanda = data.alta_demanda_mode;
                updateAltaDemandaButton(isAltaDemanda, data.tiempo_estimado);
            } catch (err) {
                alert("Error alternando el Modo Alta Demanda");
            }
        }
        
        function renderChatList(chats) {
            allChatsData = chats || [];
            const listEl = document.getElementById('chatList');
            if (!listEl) return;
            
            const countAll = allChatsData.length;
            const countWorker = allChatsData.filter(c => c.requires_worker).length;
            const countToday = allChatsData.filter(c => c.is_today).length;
            
            if (document.getElementById('countAll')) document.getElementById('countAll').innerText = countAll;
            if (document.getElementById('countWorker')) document.getElementById('countWorker').innerText = countWorker;
            if (document.getElementById('countToday')) document.getElementById('countToday').innerText = countToday;
            if (document.getElementById('chatCountBadge')) document.getElementById('chatCountBadge').innerText = countAll;
            
            let filteredChats = allChatsData;
            if (currentFilter === 'worker') {
                filteredChats = allChatsData.filter(c => c.requires_worker);
            } else if (currentFilter === 'today') {
                filteredChats = allChatsData.filter(c => c.is_today);
            }

            if (searchQuery) {
                const cleanDigits = searchQuery.replace(/[^0-9]/g, '');
                filteredChats = filteredChats.filter(c => {
                    const nameMatch = (c.name || '').toLowerCase().includes(searchQuery);
                    const msgMatch = (c.last_message || '').toLowerCase().includes(searchQuery);
                    const phoneMatch = (c.phone || '').toLowerCase().includes(searchQuery);
                    const digitsMatch = cleanDigits && (c.phone || '').replace(/[^0-9]/g, '').includes(cleanDigits);
                    return nameMatch || msgMatch || phoneMatch || digitsMatch;
                });
            }
            
            if (!filteredChats || filteredChats.length === 0) {
                let emptyMsg = 'No hay chats registrados aún.';
                if (searchQuery) {
                    emptyMsg = `🔍 No se encontraron chats para "${searchQuery}".`;
                } else if (currentFilter === 'worker') {
                    emptyMsg = '🎉 Ningún cliente requiere atención en este momento.';
                } else if (currentFilter === 'today') {
                    emptyMsg = 'No hay pedidos registrados hoy.';
                }
                listEl.innerHTML = `<div style="padding: 24px 16px; color: #64748b; text-align: center; font-size: 13px;">${emptyMsg}</div>`;
                lastRenderedListSig = "empty:" + currentFilter + ":" + searchQuery;
                return;
            }
            
            const chatsToRender = filteredChats.slice(0, displayedChatsLimit);
            const currentSig = currentFilter + '|' + searchQuery + '|' + currentPhone + '|' + displayedChatsLimit + '|' + 
                chatsToRender.map(c => c.phone + ':' + (c.last_time || '') + ':' + c.is_unread + ':' + c.requires_worker + ':' + c.is_attended + ':' + c.is_paused + ':' + (c.unread_count || 0)).join(';');
            
            if (currentSig === lastRenderedListSig) {
                return; // ⚡ Ultra optimización: CERO manipulación del DOM si los datos no cambiaron
            }
            lastRenderedListSig = currentSig;
            
            let itemsHtml = chatsToRender.map(c => {
                const pFormatted = c.phone_formatted || formatPhone(c.phone);
                const pNat = c.phone_national || getNationalPhone(c.phone);
                const unreadCountNum = c.unread_count || (c.is_unread ? 1 : 0);
                const encodedPhone = encodeURIComponent(c.phone);
                const timeStr = (c.last_time || '').split(' ')[1] || '';
                return `
                    <div class="chat-item ${c.phone === currentPhone ? 'active' : ''} ${c.requires_worker ? 'requires-worker' : ''} ${c.is_attended ? 'is-attended' : ''} ${c.is_unread ? 'has-unread' : ''}" data-phone="${encodedPhone}" onclick="selectChat(decodeURIComponent(this.getAttribute('data-phone')))">
                        <div class="chat-info">
                            <div class="chat-name">
                                <span>${escapeHtml(c.name)}</span>
                                ${c.is_unread ? '<span title="No leído / Pendiente de seguimiento" style="color:#10b981; font-size:11px;">🟢</span>' : ''}
                            </div>
                            <div class="chat-subline">
                                <span class="chat-phone-tag">📱 ${escapeHtml(pFormatted)}</span>
                                <button class="btn-quick-copy" onclick="event.stopPropagation(); copyCustomerPhone(decodeURIComponent('${encodedPhone}'));" title="Copiar celular para buscar en WhatsApp Business 977503006">📋</button>
                            </div>
                            <div class="chat-last-msg">${escapeHtml(c.last_message || '')}</div>
                            ${c.requires_worker ? `<div style="font-size: 11px; color: #facc15; margin-top: 3px; font-weight: 600;">⚠️ ${escapeHtml(c.requires_worker_reason || 'Requiere trabajador')}</div>` : ''}
                        </div>
                        <div class="chat-meta">
                            <div style="${c.is_unread ? 'color: #25d366; font-weight: 700;' : ''}">${escapeHtml(timeStr)}</div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-top: 4px;">
                                ${unreadCountNum > 0 ? `<span class="unread-count-badge" title="${unreadCountNum} mensaje(s) no leído(s)">${unreadCountNum > 99 ? '99+' : unreadCountNum}</span>` : ''}
                                ${c.requires_worker ? '<span class="badge-worker">🟡 REQUIERE ATENCIÓN</span>' : ''}
                                ${c.is_attended ? '<span class="badge-attended">✅ ATENDIDO</span>' : ''}
                                <span class="${c.is_paused ? 'badge-paused' : 'badge-active'}">
                                    ${c.is_paused ? 'PAUSADO' : 'BOT ACTIVO'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            if (filteredChats.length > displayedChatsLimit) {
                const remaining = filteredChats.length - displayedChatsLimit;
                itemsHtml += `
                    <div style="padding: 12px; text-align: center;">
                        <button onclick="loadMoreChats()" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
                            ⬇️ Mostrar más conversaciones (${remaining} más)
                        </button>
                    </div>
                `;
            }
            
            listEl.innerHTML = itemsHtml;
        }
        
        function loadMoreChats() {
            displayedChatsLimit += 60;
            lastRenderedListSig = "";
            renderChatList(allChatsData);
        }
        
        function closeChatMobile() {
            const container = document.querySelector('.main-container');
            if (container) container.classList.remove('mobile-chat-open');
        }

        async function selectChat(phoneParam) {
            initAudio();
            const phone = String(decodeURIComponent(phoneParam)).trim();
            currentPhone = phone;
            clearSelectedImage();
            
            const container = document.querySelector('.main-container');
            if (container) container.classList.add('mobile-chat-open');
            
            const chatObj = allChatsData.find(c => String(c.phone).trim() === phone);
            const name = chatObj ? chatObj.name : phone;
            const isPaused = chatObj ? !!chatObj.is_paused : false;
            const isAttended = chatObj ? !!chatObj.is_attended : false;
            const requiresWorker = chatObj ? !!chatObj.requires_worker : false;
            const workerReason = chatObj ? (chatObj.requires_worker_reason || '') : '';
            const isUnread = chatObj ? !!chatObj.is_unread : false;
            const unreadCount = chatObj ? (chatObj.unread_count || 0) : 0;
            
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('activeChatView').style.display = 'flex';
            document.getElementById('activeUserName').innerText = name;
            
            const pFormatted = formatPhone(phone);
            const pNat = getNationalPhone(phone);
            const phoneChip = document.getElementById('activeUserPhoneChip');
            if (phoneChip) phoneChip.innerText = `📱 ${pFormatted} (${pNat})`;
            
            const waLink = document.getElementById('btnOpenWa');
            if (waLink) waLink.href = `https://wa.me/51${pNat}`;
            
            isCurrentAttended = isAttended || false;
            updateAttendedButton(isCurrentAttended);
            
            // Si el chat tenía mensajes nuevos no leídos (unreadCount > 0), al hacer clic se limpia el contador
            if (unreadCount > 0) {
                isCurrentUnread = false;
                updateUnreadButton(false);
                if (chatObj) {
                    chatObj.is_unread = false;
                    chatObj.unread_count = 0;
                    renderChatList(allChatsData);
                }
                fetch('/api/dashboard/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phone })
                }).catch(e => console.error("Error al marcar como leído:", e));
            } else {
                isCurrentUnread = isUnread || false;
                updateUnreadButton(isCurrentUnread);
            }
            
            const banner = document.getElementById('workerAlertBanner');
            if (requiresWorker) {
                document.getElementById('workerReasonText').innerText = workerReason || 'Pedido por verificar o consulta pendiente';
                banner.style.display = 'flex';
            } else {
                banner.style.display = 'none';
            }

            await fetchMessages(phone, true);
        }
        
        function getDateLabel(timestampStr) {
            if (!timestampStr) return '';
            const parts = timestampStr.split(' ');
            if (parts.length < 1) return '';
            const datePart = parts[0];
            const dateComponents = datePart.split('-');
            if (dateComponents.length !== 3) return datePart;
            const y = parseInt(dateComponents[0], 10);
            const m = parseInt(dateComponents[1], 10);
            const d = parseInt(dateComponents[2], 10);
            if (isNaN(y) || isNaN(m) || isNaN(d)) return datePart;
            
            const msgDate = new Date(y, m - 1, d);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (msgDate.getTime() === today.getTime()) {
                return 'Hoy';
            } else if (msgDate.getTime() === yesterday.getTime()) {
                return 'Ayer';
            } else {
                const options = { weekday: 'long', day: 'numeric', month: 'long' };
                if (msgDate.getFullYear() !== today.getFullYear()) {
                    options.year = 'numeric';
                }
                const formatted = msgDate.toLocaleDateString('es-PE', options);
                return formatted.charAt(0).toUpperCase() + formatted.slice(1);
            }
        }
        
        async function deleteMessage(msgId) {
            if (!currentPhone || !msgId) return;
            if (!confirm("¿Deseas eliminar este mensaje del historial del panel?")) return;
            try {
                const res = await fetch('/api/dashboard/delete-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone, id: msgId })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    await fetchMessages(currentPhone, false);
                    fetchChats();
                } else {
                    alert(data.message || "Error al eliminar mensaje");
                }
            } catch (e) {
                alert("Error de conexión al eliminar mensaje");
            }
        }
        
        async function fetchMessages(phone, scrollToBottom = false) {
            try {
                const res = await fetch(`/api/dashboard/messages/${phone}`);
                if (res.status === 401) {
                    window.location.reload();
                    return;
                }
                const data = await res.json();
                if (data.name && !data.name.includes('Capribot') && !data.name.includes('Admin')) {
                    document.getElementById('activeUserName').innerText = data.name;
                }
                
                const pFormatted = data.phone_formatted || formatPhone(data.phone);
                const pNat = data.phone_national || getNationalPhone(data.phone);
                const phoneChip = document.getElementById('activeUserPhoneChip');
                if (phoneChip) phoneChip.innerText = `📱 ${pFormatted} (${pNat})`;

                const waLink = document.getElementById('btnOpenWa');
                if (waLink) waLink.href = `https://wa.me/51${pNat}`;
                
                isCurrentPaused = data.is_paused;
                updatePauseButton(data.is_paused);
                
                isCurrentAttended = data.is_attended || false;
                updateAttendedButton(isCurrentAttended);

                // Estado de NO LEÍDO se mantiene fiel: NO se desmarca en las consultas periódicas de fondo
                isCurrentUnread = data.is_unread || false;
                updateUnreadButton(isCurrentUnread);

                // Actualizar botón de Último Resumen de Pedido para POS
                currentOrderSummaryText = data.latest_order_summary || '';
                const btnSummary = document.getElementById('btnOrderSummary');
                if (btnSummary) {
                    if (currentOrderSummaryText && currentOrderSummaryText.trim().length > 0) {
                        btnSummary.style.display = 'inline-flex';
                    } else {
                        btnSummary.style.display = 'none';
                    }
                }
                
                const banner = document.getElementById('workerAlertBanner');
                if (data.requires_worker) {
                    document.getElementById('workerReasonText').innerText = data.requires_worker_reason || 'Pedido por verificar o consulta pendiente';
                    banner.style.display = 'flex';
                } else {
                    banner.style.display = 'none';
                }

                const gpsBtn = document.getElementById('activeUserGpsLink');
                if (data.gps_url) {
                    gpsBtn.href = data.gps_url;
                    gpsBtn.style.display = 'inline-flex';
                } else {
                    gpsBtn.style.display = 'none';
                }
                
                const container = document.getElementById('messagesContainer');
                const currentMsgList = data.messages || [];
                const currentLastMsg = currentMsgList.length > 0 ? currentMsgList[currentMsgList.length - 1] : null;
                const currentLastId = currentLastMsg ? currentLastMsg.id : null;
                const messagesUnchanged = (currentPhone === lastRenderedPhone) && 
                                          (currentMsgList.length === lastRenderedMsgCount) && 
                                          (currentLastId === lastRenderedLastMsgId);
                
                if (messagesUnchanged && !scrollToBottom) {
                    return; // ⚡ Mensajes sin cambios: No tocar el DOM de mensajes
                }
                
                lastRenderedPhone = currentPhone;
                lastRenderedMsgCount = currentMsgList.length;
                lastRenderedLastMsgId = currentLastId;
                
                const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
                let lastDateLabel = '';
                let messagesHtml = '';
                
                currentMsgList.forEach(m => {
                    const currentDateLabel = getDateLabel(m.timestamp);
                    if (currentDateLabel && currentDateLabel !== lastDateLabel) {
                        messagesHtml += `
                            <div class="date-separator-container">
                                <span class="date-separator-badge">📅 ${currentDateLabel}</span>
                            </div>
                        `;
                        lastDateLabel = currentDateLabel;
                    }
                    
                    let bubbleClass = 'msg-client';
                    if (m.sender === 'bot') bubbleClass = 'msg-bot';
                    if (m.sender === 'admin') bubbleClass = 'msg-admin';
                    
                    let mediaHtml = '';
                    if (m.media_type === 'image' && m.media_url) {
                        mediaHtml = `<img src="${m.media_url}" class="msg-image" onclick="window.open('${m.media_url}')" title="Clic para ampliar" />`;
                    }
                    if (m.location_url) {
                        mediaHtml += `
                            <div class="msg-location-card">
                                <div>📍 Ubicación GPS enviada</div>
                                <a href="${m.location_url}" target="_blank" class="msg-location-btn">Abrir en Google Maps 🗺️</a>
                            </div>
                        `;
                    }
                    
                    let timeOnly = m.timestamp || '';
                    if (m.timestamp && m.timestamp.includes(' ')) {
                        const timeParts = m.timestamp.split(' ');
                        if (timeParts.length >= 3) {
                            timeOnly = `${timeParts[1]} ${timeParts[2]}`;
                        } else if (timeParts.length === 2) {
                            timeOnly = timeParts[1];
                        }
                    }
                    
                    messagesHtml += `
                        <div class="message-bubble ${bubbleClass}">
                            <div class="msg-sender">${m.name}</div>
                            <div>${(m.text || '').replace(/\\n/g, '<br>')}</div>
                            ${mediaHtml}
                            <div class="msg-meta">
                                <span>${timeOnly}</span>
                                <button class="btn-delete-msg" onclick="deleteMessage(${m.id})" title="Borrar mensaje del panel">🗑️</button>
                            </div>
                        </div>
                    `;
                });
                
                container.innerHTML = messagesHtml;
                
                if (scrollToBottom || isAtBottom) {
                    container.scrollTop = container.scrollHeight;
                }
            } catch (err) {
                console.error("Error cargando mensajes:", err);
            }
        }
        
        function updatePauseButton(isPaused) {
            const btn = document.getElementById('btnTogglePause');
            if (isPaused) {
                btn.innerText = '🟢 Reanudar Bot';
                btn.className = 'btn-toggle-pause btn-resume';
            } else {
                btn.innerText = '⏸️ Pausar Bot';
                btn.className = 'btn-toggle-pause btn-pause';
            }
        }
        
        async function togglePause() {
            if (!currentPhone) return;
            try {
                const res = await fetch('/api/dashboard/toggle-pause', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                const data = await res.json();
                isCurrentPaused = data.is_paused;
                updatePauseButton(data.is_paused);
                fetchChats();
            } catch (err) {
                alert("Error cambiando estado del bot");
            }
        }
        
        function addEmoji(emoji) {
            const input = document.getElementById('messageInput');
            input.value += emoji;
            input.focus();
        }
        
        function insertQuickReply(cmd) {
            const input = document.getElementById('messageInput');
            input.value = cmd;
            input.focus();
        }
        
        function handleImageSelected(e) {
            const file = e.target.files && e.target.files[0];
            if (file) {
                setAttachedImage(file);
            }
        }
        
        function setAttachedImage(file) {
            if (!file.type.startsWith('image/')) {
                alert('Por favor selecciona un archivo de imagen válido.');
                return;
            }
            selectedImageFile = file;
            const previewContainer = document.getElementById('imagePreviewContainer');
            const previewImg = document.getElementById('imagePreviewImg');
            const previewName = document.getElementById('imagePreviewFileName');
            
            previewImg.src = URL.createObjectURL(file);
            previewName.innerText = file.name || 'foto_captura.png';
            previewContainer.style.display = 'flex';
            document.getElementById('messageInput').placeholder = 'Escribe un pie de foto opcional para la imagen...';
            document.getElementById('messageInput').focus();
        }
        
        function clearSelectedImage() {
            selectedImageFile = null;
            document.getElementById('imageFileInput').value = '';
            document.getElementById('imagePreviewContainer').style.display = 'none';
            document.getElementById('messageInput').placeholder = 'Escribe un mensaje o pie de foto (o pega una captura con Ctrl+V)...';
        }
        
        // Soporte para pegar capturas de pantalla con Ctrl+V
        window.addEventListener('paste', (e) => {
            if (!currentPhone) return;
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        setAttachedImage(blob);
                        e.preventDefault();
                        break;
                    }
                }
            }
        });
        
        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const text = input.value.trim();
            if (!currentPhone) return;
            if (!text && !selectedImageFile) return;
            
            const sendBtn = document.getElementById('btnSendMessage');
            sendBtn.disabled = true;
            sendBtn.innerText = 'Enviando...';
            
            try {
                if (selectedImageFile) {
                    const formData = new FormData();
                    formData.append('phone', currentPhone);
                    formData.append('caption', text);
                    formData.append('file', selectedImageFile);
                    
                    const res = await fetch('/api/dashboard/send-image', {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) {
                        clearSelectedImage();
                        input.value = '';
                        input.style.height = 'auto';
                        await fetchMessages(currentPhone, true);
                        fetchChats();
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        alert("Error enviando imagen por WhatsApp: " + (errData.detail || res.statusText));
                    }
                } else {
                    input.value = '';
                    const res = await fetch('/api/dashboard/send-message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: currentPhone, text: text })
                    });
                    if (res.ok) {
                        await fetchMessages(currentPhone, true);
                        fetchChats();
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        alert("Error enviando mensaje por WhatsApp: " + (errData.detail || res.statusText));
                    }
                }
            } catch (err) {
                alert("Error de conexión al enviar el mensaje.");
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerText = 'Enviar por WhatsApp';
            }
        }
        
        // Manejo de Enter para enviar y Shift+Enter para salto de línea en Textarea
        const msgTextarea = document.getElementById('messageInput');
        if (msgTextarea) {
            msgTextarea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            msgTextarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });
        }

        let isPollingChats = false;
        async function runChatPoll() {
            if (isPollingChats) return;
            isPollingChats = true;
            try {
                await fetchChats();
            } catch (e) {
                console.error("Poll error:", e);
            } finally {
                isPollingChats = false;
                setTimeout(runChatPoll, 3500);
            }
        }
        runChatPoll();
    </script>
</body>
</html>
"""
    return HTMLResponse(content=html_content, headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})

@app.post("/cmd/actualizar")
async def api_actualizar_carta():
    """Endpoint para recargar la carta desde menu_dinamico.txt manualmente."""
    ok = load_dynamic_menu()
    if ok:
        return {"status": "success", "message": "Carta recargada exitosamente desde menu_dinamico.txt."}
    return {"status": "error", "message": "Error al recargar menu_dinamico.txt."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("bot_wa:app", host="0.0.0.0", port=8000, reload=True)



