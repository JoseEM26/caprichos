import os
import logging
import base64
import json
import re
import httpx
from datetime import datetime
import pytz
import unicodedata
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
from openai import AsyncOpenAI

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
    "mocaccino": "MOCACCINO.png",
    "moccacino": "MOCACCINO.png",
    "moca caliente": "MOCACCINO.png",
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
    
    # Postres y Combos
    "torta de chocolate": "TORTA_DE_CHOCOLATE.png",
    "crema volteada": "CREMA_VOLTEADA.png",
    "pie de limon": "PIE_DE_LIMON.jpeg",
    "gelatina mosaico": "GELATINA_MOSAICO.png",
    "carrot cake": "CARROT_CAKE_TAJADA.png",
    "carrot cake tajada": "CARROT_CAKE_TAJADA.png",
    "keke de zanahoria": "CARROT_CAKE_TAJADA.png",
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
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GRUPO_PEDIDOS_ID = os.getenv("GRUPO_PEDIDOS_ID")

# Inicializar Cliente OpenAI
client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Memoria de sesiones
user_sessions = {}
user_gps = {} # Para almacenar la última ubicación enviada por el usuario
CURRENT_PROMPT = SYSTEM_PROMPT

def check_pack_amarillo_registered(chat_id) -> bool:
    """Verifica si en este chat ya hubo previamente una conversación de registro o reserva del Pack Amarillo."""
    if chat_id in user_sessions:
        for msg in user_sessions[chat_id]:
            role = msg.get("role")
            content = str(msg.get("content", "")).lower()
            if role == "tool":
                name = msg.get("name", "")
                if name == "derivar_reserva_promo_amarilla":
                    return True
                if name == "calcular_total_pedido" and ("pack amarillo" in content or "combo amarillo" in content):
                    return True
            if role == "assistant":
                if ("alerta a nuestro equipo para agendar tu reserva" in content and "amarillo" in content) or \
                   ("reserva del pack amarillo" in content) or \
                   ("reserva del combo amarillo" in content) or \
                   ("desglose de tu pedido" in content and "pack amarillo" in content) or \
                   ("1x pack amarillo" in content) or \
                   ("he enviado la alerta para tu reserva del pack amarillo" in content):
                    return True
    return False

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
SPECIAL_NOTICE_FILE_TG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "special_notice_notified_tg.json")

def load_special_notice_notified_tg() -> set:
    if os.path.exists(SPECIAL_NOTICE_FILE_TG):
        try:
            with open(SPECIAL_NOTICE_FILE_TG, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("date") == SPECIAL_NOTICE_DATE:
                    return set(data.get("users", []))
        except Exception as e:
            logger.error(f"Error cargando archivo de aviso especial TG: {e}")
    return set()

def save_special_notice_notified_tg(users: set):
    try:
        with open(SPECIAL_NOTICE_FILE_TG, "w", encoding="utf-8") as f:
            json.dump({"date": SPECIAL_NOTICE_DATE, "users": list(users)}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error guardando archivo de aviso especial TG: {e}")

special_notice_notified_users_tg = load_special_notice_notified_tg()

def is_special_notice_active() -> bool:
    try:
        tz = pytz.timezone("America/Lima")
        today_str = datetime.now(tz).strftime("%Y-%m-%d")
    except Exception:
        today_str = datetime.now().strftime("%Y-%m-%d")
    return today_str == SPECIAL_NOTICE_DATE

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
            "description": "Envía una foto o imagen referencial de un producto de la carta cuando pregunte por fotos, pida ver cómo es o cómo viene el producto (disponible para waffles, frappés, frozens, sándwiches, postres, cajita caprikids, pack amarillo y termo caprichos).",
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
                        "description": "Detalles mencionados por el cliente (ej. sabor de frappé 12oz, cantidad de packs, modalidad entrega o datos brindados)"
                    }
                },
                "required": []
            }
        }
    }
]

# ----------------------------------------------------
# CONTROL DE TIMEOUT DE SESIÓN POR INACTIVIDAD (3 HORAS)
# ----------------------------------------------------
SESSION_TIMEOUT_HOURS = 3  # Reseteo automático tras 3 horas de inactividad
SESSION_TIMEOUT_SECONDS = SESSION_TIMEOUT_HOURS * 3600
user_last_activity_tg = {}

async def get_ai_response(chat_id: int, user_message: str = None, is_photo: bool = False, photo_base64: str = None, hidden_system_message: str = None) -> str:
    """Obtiene la respuesta de ChatGPT manteniendo el contexto de la conversación."""
    now_ts = datetime.now().timestamp()
    
    # Verificar si la sesión expiró por inactividad (más de 3 horas)
    if chat_id in user_last_activity_tg:
        elapsed = now_ts - user_last_activity_tg[chat_id]
        if elapsed > SESSION_TIMEOUT_SECONDS:
            logger.info(f"⌛ Sesión expirada por inactividad para Telegram chat {chat_id} ({elapsed/3600:.1f} horas sin interacción). Reseteando conversación...")
            user_sessions.pop(chat_id, None)
            user_gps.pop(chat_id, None)
            pending_validation_users_tg.discard(chat_id)

    user_last_activity_tg[chat_id] = now_ts

    lima_tz = pytz.timezone('America/Lima')
    now = datetime.now(lima_tz)
    en_horario = 14 <= now.hour < 22
    hora_str = now.strftime('%I:%M %p')
    
    contexto_horario = f"HORA ACTUAL EN LIMA: {hora_str}. "
    if en_horario:
        contexto_horario += "DENTRO DEL HORARIO DE ATENCIÓN DE COCINA Y TIENDA (2:00 PM - 10:00 PM)."
    else:
        contexto_horario += "FUERA DEL HORARIO DE ATENCIÓN DE COCINA Y TIENDA (Atención en tienda/recojo y despachos de delivery son de 2:00 PM a 10:00 PM). SI ES EL PRIMER MENSAJE DE LA CONVERSACIÓN, RECUERDA INCLUIR OBLIGATORIAMENTE EL AVISO DE HORARIO DE ATENCIÓN."

    if chat_id not in user_sessions:
        sys_msgs = [
            {"role": "system", "content": CURRENT_PROMPT},
            {"role": "system", "content": contexto_horario}
        ]
        client_info = get_client_data(str(chat_id))
        if client_info and client_info.get("nombre") and client_info.get("nombre") != "Cliente Caprichos":
            c_name = client_info["nombre"]
            c_cel = client_info.get("celular", str(chat_id))
            c_pedidos = client_info.get("total_pedidos_aprobados", 0)
            contexto_cliente = (
                f"DATOS DE MEMORIA DEL CLIENTE REGISTRADO: Nombre: {c_name}, Celular: {c_cel}, Pedidos Aprobados Anteriores: {c_pedidos}. "
                f"ESTE CLIENTE YA ES FRECUENTE Y ESTÁ REGISTRADO. ESTÁ ESTRICTAMENTE PROHIBIDO PEDIRLE SU NOMBRE O CELULAR DE NUEVO al momento de registrar el pedido. "
                f"Al ser su PRIMER mensaje en esta sesión, salúdalo amablemente por su nombre presentándote como Capribot ('¡Hola, {c_name}! Te habla Capribot 👋🤖') "
                f"y envíale la invitación oficial a la página web tal como lo indica la regla de bienvenida inicial. "
                f"ESTÁ PROHIBIDO decir 'en el mensaje de arriba 👆' en el primer mensaje de la sesión."
            )
            sys_msgs.append({"role": "system", "content": contexto_cliente})

        user_sessions[chat_id] = sys_msgs



    
    has_previous_assistant_msg = any(msg.get("role") == "assistant" for msg in user_sessions[chat_id])
    if has_previous_assistant_msg:
        user_sessions[chat_id].append({
            "role": "system",
            "content": (
                "ATENCIÓN CRÍTICA: Ya enviaste el mensaje inicial de bienvenida con la carta web en este chat. "
                "ESTÁ ABSOLUTAMENTE PROHIBIDO volver a enviar el enlace a la página web (https://caprichos.restaurant.pe/...) "
                "o repetir 'Le invitamos a realizar su pedido...'. "
                "Si el cliente saluda de nuevo, se queja de que la web demora/no carga, o dice que quiere pedir por aquí, dile amablemente que la carta web está en el mensaje de arriba 👆 "
                "pero que con mucho gusto puedes tomarle su pedido por el chat o compartirle la carta de WhatsApp (https://wa.me/c/51977503006)."
            )
        })

    # Contexto dinámico según estado del Pack Amarillo (Agotado vs Registro previo existente)
    ya_tiene_registro_pack = check_pack_amarillo_registered(chat_id)
    if ya_tiene_registro_pack:
        contexto_promo_pack = (
            "ESTADO PROMOCIÓN PACK AMARILLO (CLIENTE CON REGISTRO/RESERVA PREVIA REALIZADA 💛🌻):\n"
            "IMPORTANTE: En este chat YA SE INICIÓ O SE REGISTRÓ PREVIAMENTE LA RESERVA/PEDIDO DEL PACK AMARILLO con este cliente.\n"
            "POR NINGÚN MOTIVO le digas a este cliente que el Pack Amarillo está agotado, ni canceles su reserva ni contradigas su registro.\n"
            "Atiende sus consultas con total normalidad y amabilidad sobre su pedido ya registrado (coordinación de envío, horario, datos, pago, etc.).\n"
            "(Nota: Únicamente si el cliente solicita explícitamente agregar UN NUEVO o ADICIONAL Pack Amarillo extra, indícale amablemente que las nuevas unidades se encuentran agotadas, pero su pedido ya registrado se encuentra garantizado)."
        )
    else:
        contexto_promo_pack = (
            "ESTADO PROMOCIÓN PACK AMARILLO (¡TOTALMENTE AGOTADO! 💛🌻):\n"
            "¡ATENCIÓN CRÍTICA! La promoción del 'Pack Amarillo' (Combo Amarillo / Rosas Amarillas) YA ESTÁ TOTALMENTE AGOTADA POR ALTA DEMANDA.\n"
            "ESTÁ ESTRICTAMENTE PROHIBIDO tomar nuevos pedidos o registrar nuevas reservas del Pack Amarillo.\n"
            "Si el cliente pregunta por el Pack Amarillo, solicita fotos, o pide pedirlo/reservarlo:\n"
            "Infórmale de inmediato con mucha empatía y calidez que debido a la enorme acogida, el Pack Amarillo se encuentra COMPLETAMENTE AGOTADO 💛🌻.\n"
            "Ofrécele con entusiasmo las deliciosas opciones de nuestra carta regular (frappés de 12oz y 16oz en todos sus sabores, postres artesanales, waffles, sándwiches, hamburguesas, etc.) o compártele el catálogo de WhatsApp (https://wa.me/c/51977503006).\n"
            "NO utilices la herramienta `derivar_reserva_promo_amarilla` ni agregues el Pack Amarillo en `calcular_total_pedido`."
        )
    
    # Limpiar posibles mensajes de sistema de promo previos para no saturar el historial
    user_sessions[chat_id] = [
        msg for msg in user_sessions[chat_id]
        if not (msg.get("role") == "system" and "ESTADO PROMOCIÓN PACK AMARILLO" in str(msg.get("content", "")))
    ]
    user_sessions[chat_id].append({"role": "system", "content": contexto_promo_pack})

    if hidden_system_message:
        user_sessions[chat_id].append({"role": "system", "content": hidden_system_message})
    
    if is_photo and photo_base64:
        user_text = user_message if user_message else "El usuario envió esta imagen."
        user_sessions[chat_id].append({
            "role": "user",
            "content": [
                {"type": "text", "text": f"{user_text}\n\nINSTRUCCIÓN INTERNA: Analiza la imagen. Si es un comprobante de pago (Yape, Plin, BCP, Interbank, etc.), lee y extrae explícitamente el MONTO, el NÚMERO/CÓDIGO DE OPERACIÓN y la FECHA Y HORA DE LA TRANSACCIÓN del comprobante. Guarda estos datos internamente para incluirlos en el ticket de Telegram. Si es una captura de pantalla del menú/carta, identifica qué producto es y consúltale tamaño/sabor (incluyendo siempre los precios de cada tamaño) para añadirlo al carrito."},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{photo_base64}",
                    },
                },
            ],
        })
    elif user_message:
        user_sessions[chat_id].append({"role": "user", "content": user_message})

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=user_sessions[chat_id],
            temperature=0.1,
            tools=tools,
            tool_choice="auto"
        )
        message = response.choices[0].message
        
        if message.tool_calls:
            user_sessions[chat_id].append({
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
                        if not check_pack_amarillo_registered(chat_id):
                            tiene_pack_amarillo = any("amarillo" in str(it.get("name", "")).lower() for it in items)
                            if tiene_pack_amarillo:
                                tool_content = (
                                    "Error: El Pack Amarillo se encuentra COMPLETAMENTE AGOTADO por alta demanda. "
                                    "No es posible añadirlo al pedido. Por favor informa amablemente al cliente que el Pack Amarillo ya se agotó y ofrécele las deliciosas opciones de nuestra carta regular."
                                )
                                user_sessions[chat_id].append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "name": tool_call.function.name,
                                    "content": tool_content
                                })
                                continue

                        subtotal_productos = 0
                        breakdown = ""
                        for item in items:
                            sub = item['price'] * item['quantity']
                            subtotal_productos += sub
                            breakdown += f"- {item['quantity']}x {item['name']} (S/ {item['price']} c/u) = S/ {sub:.2f}\n"
                        
                        # Regla: Todos los pedidos en productos mayores a S/ 70 tienen delivery GRATIS
                        if subtotal_productos > 70:
                            if delivery_cost > 0:
                                breakdown += f"- Delivery = S/ 0.00 (¡GRATIS por compra mayor a S/ 70! 🎉)\n"
                            delivery_cost = 0.0
                        elif delivery_cost > 0:
                            breakdown += f"- Delivery = S/ {delivery_cost:.2f}\n"
                        
                        total = subtotal_productos + delivery_cost
                        breakdown += f"\nTotal exacto a pagar: S/ {total:.2f}\n(Este es el cálculo del sistema, úsalo para presentar el desglose al cliente y continuar con el cobro)."
                        
                        user_sessions[chat_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": breakdown
                        })
                    elif tool_call.function.name == "enviar_foto_producto":
                        args = json.loads(tool_call.function.arguments)
                        p_name = str(args.get("product_name", "")).strip()
                        img_path = find_product_image(p_name)
                        if img_path and os.path.exists(img_path):
                            tool_content = f"Foto referencial de '{p_name}' encontrada y disponible."
                        else:
                            tool_content = f"No se encontró foto para '{p_name}'."
                        user_sessions[chat_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": tool_content
                        })
                    elif tool_call.function.name == "derivar_reserva_promo_amarilla":
                        if not check_pack_amarillo_registered(chat_id):
                            tool_content = (
                                "El Pack Amarillo se encuentra COMPLETAMENTE AGOTADO por alta demanda. "
                                "No es posible registrar nuevas reservas ni pedidos. "
                                "Por favor informa amablemente al cliente que el Pack Amarillo ya está agotado y ofrécele productos de nuestra carta regular."
                            )
                            user_sessions[chat_id].append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "name": tool_call.function.name,
                                "content": tool_content
                            })
                            continue

                        args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                        detalle = str(args.get("detalle_reserva", "")).strip()
                        tool_content = (
                            "Alerta de reserva del Pack Amarillo registrada. "
                            "Informa al cliente amablemente que hemos enviado una alerta a nuestro equipo y que en breves momentos un asesor se comunicará por este chat para tomar sus datos y agendar su reserva para el lunes 21/09."
                        )
                        user_sessions[chat_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": tool_content
                        })
                    else:
                        user_sessions[chat_id].append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": tool_call.function.name,
                            "content": "Error: Función desconocida."
                        })
                except Exception as inner_e:
                    logger.error(f"Error procesando tool_call {tool_call.id}: {inner_e}")
                    user_sessions[chat_id].append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_call.function.name,
                        "content": "Error interno procesando los argumentos."
                    })
            
            # Segunda llamada con el resultado matemático
            response2 = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=user_sessions[chat_id],
                temperature=0.1
            )
            ai_reply = response2.choices[0].message.content
        else:
            ai_reply = message.content

        # Filtro de seguridad: Evitar repetición accidental del enlace a la web si ya se envió antes
        if has_previous_assistant_msg and "https://caprichos.restaurant.pe" in ai_reply:
            logger.warning(f"⚠️ El bot intentó repetir el enlace web para {chat_id}. Sanitizando respuesta...")
            ai_reply = (
                "La carta web está en el mensaje de arriba 👆, pero si gustas con mucho gusto puedo tomarte el pedido directamente por aquí 🥰.\n\n"
                "Aquí también puedes observar nuestra carta digital de WhatsApp 👉 https://wa.me/c/51977503006 📋✨\n\n"
                "Cuéntame, ¿qué se te antoja o qué te gustaría pedir hoy? 🍹🍔"
            )

        user_sessions[chat_id].append({"role": "assistant", "content": ai_reply})
        return ai_reply
    except Exception as e:
        logger.error(f"Error en OpenAI API: {e}")
        return "Lo siento, tuve un problema procesando tu petición. ¿Podrías repetirlo? 🙏"

async def generate_kitchen_ticket(chat_id: int, user) -> str:
    """Genera el ticket final resumiendo la conversación para la cocina."""
    gps_info = ""
    if chat_id in user_gps:
        lat = user_gps[chat_id]['lat']
        lon = user_gps[chat_id]['lon']
        maps_url = f"https://www.google.com/maps?q={lat},{lon}"
        gps_info = f"Ubicación GPS: {maps_url}"
    else:
        gps_info = "Atención en Tienda (Recojo) / Consumo en Salón"

    prompt_ticket = f"""
Basado en toda la conversación anterior, genera el ticket de cocina EXACTAMENTE con este formato.
Extrae el Nombre, Apellido y Número de Celular que el cliente proporcionó en la conversación. Si no los dio explícitamente, usa su nombre de Telegram como respaldo: {user.first_name}.

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
    # Hacemos una copia temporal de la sesión para no ensuciar la memoria del usuario
    temp_messages = user_sessions[chat_id].copy()
    temp_messages.append({"role": "user", "content": prompt_ticket})
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=temp_messages,
            temperature=0.1,
        )
        raw_ticket = response.choices[0].message.content.strip()
        raw_ticket = re.sub(r"^#?pedido\s*\d*\s*\n?", "", raw_ticket, flags=re.IGNORECASE).strip()
        if chat_id in user_gps:
            lat = user_gps[chat_id]['lat']
            lon = user_gps[chat_id]['lon']
            maps_url = f"https://www.google.com/maps?q={lat},{lon}"
            raw_ticket = re.sub(r"Ubicaci[oó]n:.*", f"Ubicación (GPS): {maps_url}", raw_ticket, flags=re.IGNORECASE)
        else:
            is_recojo_local = any(k in raw_ticket.lower() for k in ["recojo", "recoger", "tienda", "local", "salon", "salón", "llevar"])
            if is_recojo_local:
                if any(k in raw_ticket.lower() for k in ["local", "salón", "salon", "mesa"]):
                    raw_ticket = re.sub(r"Ubicaci[oó]n:.*", "Ubicación: Consumo en Salón/Local", raw_ticket, flags=re.IGNORECASE)
                else:
                    raw_ticket = re.sub(r"Ubicaci[oó]n:.*", "Ubicación: Atención en Tienda (Recojo)", raw_ticket, flags=re.IGNORECASE)

        try:
            lines = [line.strip() for line in raw_ticket.split("\n") if line.strip()]
            if len(lines) >= 2:
                extracted_name = lines[0]
                extracted_cel = lines[1]
                if extracted_name and not any(extracted_name.lower().startswith(k) for k in ["modalidad", "ubicaci", "pedido", "total"]):
                    save_client_info(str(chat_id), name=extracted_name, cel=extracted_cel)
        except Exception as save_err:
            logger.error(f"Error registrando cliente en clientes.json desde Telegram: {save_err}")

        return raw_ticket
    except Exception as e:
        logger.error(f"Error generando ticket: {e}")
        return f"Error generando ticket para {user.first_name}"

def is_order_ready_for_telegram_tg(chat_id: int, ai_reply: str) -> bool:
    """Verifica programáticamente que el pedido esté completo y calculado antes de enviar a validación."""
    ai_lower = ai_reply.lower()
    has_registration_phrase = ("pedido registrado" in ai_lower) or ("área encargada" in ai_lower and "validación" in ai_lower)
    if not has_registration_phrase:
        return False
        
    history = user_sessions.get(chat_id, [])
    if not history:
        return False
        
    has_tool_calculation = any(
        msg.get("role") == "tool" and "total exacto a pagar" in str(msg.get("content", "")).lower()
        for msg in history
    )
    if not has_tool_calculation:
        logger.warning(f"⚠️ Envío a Telegram bloqueado para Telegram chat {chat_id}: Aún no se ha ejecutado 'calcular_total_pedido'.")
        return False

    # Si la orden es para Delivery, es OBLIGATORIO que se haya recibido la ubicación GPS
    history_text = " ".join([str(m.get("content", "")) for m in history]).lower()
    is_recojo_o_local = any(k in history_text for k in ["recojo en tienda", "para recoger", "recojo", "consumo en el local", "comer en el local", "en el local", "en tienda", "para llevar"])
    if not is_recojo_o_local and chat_id not in user_gps:
        logger.warning(f"⚠️ Envío a Telegram bloqueado para Telegram chat {chat_id}: Pedido para Delivery sin ubicación GPS registrada.")
        return False
        
    return True

# Memoria de usuarios de Telegram pausados a la espera de aprobación
pending_validation_users_tg = set()

async def check_and_send_ticket(update: Update, context: ContextTypes.DEFAULT_TYPE, ai_reply: str, photo_file_id: str = None) -> None:
    """Revisa si la IA confirmó el pedido y envía validación a los administradores."""
    chat_id = update.message.chat_id
    
    if not is_order_ready_for_telegram_tg(chat_id, ai_reply):
        return

    # Pausar respuestas del bot para este usuario
    pending_validation_users_tg.add(chat_id)
    logger.info(f"🔒 Usuario Telegram {chat_id} pausado a la espera de aprobación por el Admin.")

    ticket_text = await generate_kitchen_ticket(chat_id, update.effective_user)
    ticket_text = f"🚨 *[NUEVO PEDIDO POR VALIDAR]* 🚨\n\n{ticket_text}"
    
    keyboard = [
        [InlineKeyboardButton("✅ Aprobar Pedido", callback_data=f"approve_{chat_id}")],
        [InlineKeyboardButton("❌ Rechazar (Monto Inválido)", callback_data=f"reject_{chat_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    admin_chat_id = GRUPO_PEDIDOS_ID if GRUPO_PEDIDOS_ID else chat_id
    
    try:
        if photo_file_id:
            await context.bot.send_photo(chat_id=admin_chat_id, photo=photo_file_id, caption=ticket_text, reply_markup=reply_markup)
        else:
            await context.bot.send_message(chat_id=admin_chat_id, text=ticket_text, reply_markup=reply_markup)
        
        # Enviar GPS a cocina si es delivery
        is_recojo_o_local = any(k in ticket_text.lower() for k in ["recojo", "tienda", "local", "salon", "salón"])
        if chat_id in user_gps and not is_recojo_o_local:
            await context.bot.send_location(
                chat_id=admin_chat_id,
                latitude=user_gps[chat_id]['lat'],
                longitude=user_gps[chat_id]['lon']
            )
    except Exception as e:
        logger.error(f"No se pudo enviar el ticket de validación: {e}")

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja los clics en los botones de aprobar/rechazar."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    action, chat_id_str = data.split("_")
    customer_chat_id = int(chat_id_str)
    
    # Liberar la pausa del usuario
    pending_validation_users_tg.discard(customer_chat_id)
    logger.info(f"🔓 Usuario Telegram {customer_chat_id} despausado tras acción del Admin.")

    original_text = query.message.caption if query.message.photo else query.message.text
    
    if action == "approve":
        # Incrementa en 1 el contador de pedidos aprobados del cliente únicamente al aprobar
        total_pedidos = increment_approved_order_count(str(customer_chat_id))

        # Editar mensaje para quitar botones
        new_text = f"✅ PEDIDO APROBADO (Pedido N° {total_pedidos} de este cliente)\n\n{original_text}"
        if query.message.photo:
            await query.edit_message_caption(caption=new_text)
        else:
            await query.edit_message_text(text=new_text)

            
        is_recojo_o_local = any(k in original_text.lower() for k in ["recojo", "recoger", "llevar", "tienda", "local", "salon", "salón", "retirar"])
        if is_recojo_o_local:
            confirm_msg = "Gracias 🥰\n\nSu pedido ha sido aceptado con éxito 🎉. Le avisaremos por aquí cuando su pedido esté listo para su recojo 🛍️✨. ¡Muchas gracias por su preferencia! 🙌🏻"
        else:
            confirm_msg = "Gracias 🥰 \n\nEn un plazo aprox a 30 - 45 mnts. estará llegando su pedido 🙌🏻, por favor este atent@ que el Delivery le anticipará su llegada vía WhatsApp o llamada✌️🤗"
        await context.bot.send_message(chat_id=customer_chat_id, text=confirm_msg)
        
        # Enviar GPS a cocina
        if customer_chat_id in user_gps:
            admin_chat_id = query.message.chat_id
            await context.bot.send_location(
                chat_id=admin_chat_id,
                latitude=user_gps[customer_chat_id]['lat'],
                longitude=user_gps[customer_chat_id]['lon']
            )
            
    elif action == "reject":
        new_text = f"❌ PEDIDO RECHAZADO\n\n{original_text}"
        if query.message.photo:
            await query.edit_message_caption(caption=new_text)
        else:
            await query.edit_message_text(text=new_text)
            
        reject_msg = "Hola, lamentablemente hemos encontrado un problema con la validación de su pago (el monto no coincide o no se pudo verificar). Por favor, revise e intente enviar el comprobante correcto nuevamente 🙏."
        await context.bot.send_message(chat_id=customer_chat_id, text=reject_msg)

        if query.message.photo:
            await query.edit_message_caption(caption=new_text)
        else:
            await query.edit_message_text(text=new_text)
            
        reject_msg = "Hola, lamentablemente hemos encontrado un problema con la validación de su pago (el monto no coincide o no se pudo verificar). Por favor, revise e intente enviar el comprobante correcto nuevamente 🙏."
        await context.bot.send_message(chat_id=customer_chat_id, text=reject_msg)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.message.chat_id
    
    # Calcular la hora en Lima
    lima_tz = pytz.timezone('America/Lima')
    hora_actual = datetime.now(lima_tz).hour
    
    if 5 <= hora_actual < 12:
        saludo = "Buenos días"
    elif 12 <= hora_actual < 19:
        saludo = "Buenas tardes"
    else:
        saludo = "Buenas noches"

    user_sessions[chat_id] = [
        {"role": "system", "content": CURRENT_PROMPT}
    ]
    ai_reply = await get_ai_response(chat_id, user_message=f"Hola", hidden_system_message=f"Usa este saludo exacto: '{saludo}' y luego preséntate amablemente.")
    await update.message.reply_text(ai_reply)

def parse_dms_coordinates(text: str):
    """Parsea coordenadas en formato sexagesimal (ej: 12°00'43.2"S 76°58'49.8"W)."""
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
        
    # 1. Probar primero si viene en formato sexagesimal (grados, minutos, segundos)
    dms_coords = parse_dms_coordinates(text)
    if dms_coords:
        return dms_coords

    # 2. Si es enlace corto de Google Maps, expandir la redirección
    short_link_match = re.search(r"(https?://maps\.app\.goo\.gl/[a-zA-Z0-9_-]+)", text)
    if short_link_match:
        short_url = short_link_match.group(1)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(short_url, follow_redirects=True)
                text += " " + str(response.url)
        except Exception as e:
            logger.error(f"Error resolviendo enlace corto de Google Maps: {e}")

    # Re-probar sexagesimal por si la URL expandida o título trae DMS
    dms_coords_post = parse_dms_coordinates(text)
    if dms_coords_post:
        return dms_coords_post

    # 3. Formatos estándar de URL y coordenadas decimales
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
# DEBOUNCER / AGRUPADOR DE MENSAJES CONSECUTIVOS (5 SEGUNDOS)
# ----------------------------------------------------
DEBOUNCE_DELAY = 10.0  # Tiempo de espera en segundos para agrupar mensajes seguidos (10s)

tg_user_buffers = {}
tg_user_debounce_tasks = {}
tg_user_pending_photos = {}
tg_user_pending_system_msgs = {}
tg_user_contexts = {}

async def process_debounced_messages_tg(chat_id: int):
    """Espera DEBOUNCE_DELAY segundos para consolidar mensajes consecutivos antes de responder."""
    try:
        await asyncio.sleep(DEBOUNCE_DELAY)
    except asyncio.CancelledError:
        return

    messages_list = tg_user_buffers.pop(chat_id, [])
    photo_info = tg_user_pending_photos.pop(chat_id, None)
    hidden_sys = tg_user_pending_system_msgs.pop(chat_id, None)
    update_context = tg_user_contexts.pop(chat_id, None)
    tg_user_debounce_tasks.pop(chat_id, None)

    # 0. AVISO ESPECIAL DE CORTE DE ENERGÍA (SOLO POR HOY):
    if is_special_notice_active():
        if chat_id not in special_notice_notified_users_tg:
            logger.info(f"📢 Enviando aviso especial de corte de energía con imagen a Telegram chat {chat_id}...")
            update, _ = update_context
            if os.path.exists(SPECIAL_NOTICE_IMAGE_PATH):
                with open(SPECIAL_NOTICE_IMAGE_PATH, "rb") as photo_file:
                    await update.message.reply_photo(photo=photo_file, caption=SPECIAL_NOTICE_TEXT)
            else:
                await update.message.reply_text(SPECIAL_NOTICE_TEXT)
            special_notice_notified_users_tg.add(chat_id)
            save_special_notice_notified_tg(special_notice_notified_users_tg)
            logger.info(f"✅ Aviso de corte enviado a Telegram chat {chat_id}. El bot no responderá nada más hoy.")
            return
        else:
            logger.info(f"🤐 Mensaje recibido en Telegram de {chat_id}, pero ya se le envió el aviso de corte hoy. No se responde nada.")
            return

    # REGLA DE PAUSA: Si el usuario está a la espera de validación manual en Telegram, NO responder
    if chat_id in pending_validation_users_tg:
        logger.info(f"🤐 El bot no responderá a Telegram chat {chat_id} porque su pedido está pendiente de aprobación por el Admin.")
        return

    if not update_context or (not messages_list and not photo_info):
        return


    update, context = update_context
    combined_text = "\n".join([m for m in messages_list if m])

    if photo_info:
        base64_image, photo_file_id = photo_info
        ai_reply = await get_ai_response(
            chat_id,
            is_photo=True,
            photo_base64=base64_image,
            user_message=combined_text if combined_text else None,
            hidden_system_message=hidden_sys
        )
        await update.message.reply_text(ai_reply)
        await check_and_send_ticket(update, context, ai_reply, photo_file_id)
    else:
        ai_reply = await get_ai_response(
            chat_id,
            user_message=combined_text if combined_text else None,
            hidden_system_message=hidden_sys
        )
        await update.message.reply_text(ai_reply)
        await check_and_send_ticket(update, context, ai_reply)

def add_to_user_buffer_tg(chat_id: int, update: Update, context: ContextTypes.DEFAULT_TYPE, text: str = None, photo_info = None, hidden_sys = None):
    if chat_id not in tg_user_buffers:
        tg_user_buffers[chat_id] = []
    if text:
        tg_user_buffers[chat_id].append(text)
    if photo_info:
        tg_user_pending_photos[chat_id] = photo_info
    if hidden_sys:
        tg_user_pending_system_msgs[chat_id] = hidden_sys
    tg_user_contexts[chat_id] = (update, context)

    if chat_id in tg_user_debounce_tasks and not tg_user_debounce_tasks[chat_id].done():
        tg_user_debounce_tasks[chat_id].cancel()

    tg_user_debounce_tasks[chat_id] = asyncio.create_task(process_debounced_messages_tg(chat_id))

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.message.chat_id
    user_message = update.message.text
    
    coords = await extract_coordinates_from_text(user_message)
    mensaje_sistema = None
    if coords:
        lat, lon = coords
        costo_delivery = calculate_delivery_cost(lat, lon)
        costo_delivery = get_client_delivery_cost(str(chat_id), costo_delivery)
        user_gps[chat_id] = {'lat': lat, 'lon': lon}
        
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
            
    add_to_user_buffer_tg(chat_id, update, context, text=user_message, hidden_sys=mensaje_sistema)

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja la recepción de ubicaciones GPS."""
    chat_id = update.message.chat_id
    user_location = update.message.location
    lat, lon = user_location.latitude, user_location.longitude
    
    costo_delivery = calculate_delivery_cost(lat, lon)
    costo_delivery = get_client_delivery_cost(str(chat_id), costo_delivery)
    user_gps[chat_id] = {'lat': lat, 'lon': lon}
    
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
    
    add_to_user_buffer_tg(chat_id, update, context, text="[He enviado mi ubicación GPS actual]", hidden_sys=mensaje_sistema)

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja las imágenes (vouchers o capturas de menú)."""
    chat_id = update.message.chat_id
    user_text = update.message.caption or "" # Texto que puede venir con la foto
    
    photo_file = await update.message.photo[-1].get_file()
    photo_bytes = await photo_file.download_as_bytearray()
    base64_image = base64.b64encode(photo_bytes).decode('utf-8')
    
    add_to_user_buffer_tg(chat_id, update, context, text=user_text, photo_info=(base64_image, update.message.photo[-1].file_id))


async def cmd_actualizar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando para recargar la carta desde menu_dinamico.txt sin reiniciar."""
    ok = load_dynamic_menu()
    if ok:
        await update.message.reply_text("✅ ¡Carta recargada desde menu_dinamico.txt en la memoria de la IA con éxito!")
    else:
        await update.message.reply_text("❌ Hubo un error al intentar recargar menu_dinamico.txt.")

def main() -> None:
    if not TELEGRAM_TOKEN or not OPENAI_API_KEY:
        print("❌ Faltan las credenciales. Configura .env con TELEGRAM_TOKEN y OPENAI_API_KEY.")
        return

    print("🤖 Iniciando Bot de Caprichos (con Zonas y Visión)...")
    application = Application.builder().token(TELEGRAM_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("actualizar", cmd_actualizar))
    application.add_handler(CallbackQueryHandler(button_callback))
    application.add_handler(MessageHandler(filters.LOCATION, handle_location))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
