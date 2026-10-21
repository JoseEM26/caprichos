import json
import os
import logging
from datetime import datetime

CLIENTS_FILE = "clientes.json"
logger = logging.getLogger(__name__)

def load_clients() -> dict:
    if os.path.exists(CLIENTS_FILE):
        try:
            with open(CLIENTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error cargando {CLIENTS_FILE}: {e}")
            return {}
    return {}

def _clean_phone(phone: str) -> str:
    return str(phone).replace("+", "").replace(" ", "").replace("-", "").strip()

def save_client_info(phone: str, name: str = None, cel: str = None, location: dict = None) -> None:
    """Guarda o actualiza la información del cliente en clientes.json."""
    clients = load_clients()
    phone_key = _clean_phone(phone)
    
    if phone_key not in clients:
        clients[phone_key] = {
            "nombre": name if name else "Cliente Caprichos",
            "celular": cel if cel else phone_key,
            "total_pedidos_aprobados": 0,
            "fecha_registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    else:
        if name and name.strip() and name != "Cliente Caprichos":
            clients[phone_key]["nombre"] = name.strip()
        if cel and cel.strip():
            clients[phone_key]["celular"] = cel.strip()

    if location and isinstance(location, dict):
        clients[phone_key]["ultima_ubicacion"] = location

    try:
        with open(CLIENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(clients, f, ensure_ascii=False, indent=2)
        logger.info(f"💾 Datos guardados en clientes.json para {phone_key}: {clients[phone_key]}")
    except Exception as e:
        logger.error(f"Error guardando cliente en {CLIENTS_FILE}: {e}")

def increment_approved_order_count(phone: str) -> int:
    """Incrementa en 1 el contador de pedidos aprobados ÚNICAMENTE cuando el admin aprueba desde Telegram."""
    clients = load_clients()
    phone_key = _clean_phone(phone)
    
    if phone_key not in clients:
        clients[phone_key] = {
            "nombre": "Cliente Caprichos",
            "celular": phone_key,
            "total_pedidos_aprobados": 1,
            "fecha_registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    else:
        clients[phone_key]["total_pedidos_aprobados"] = clients[phone_key].get("total_pedidos_aprobados", 0) + 1

    try:
        with open(CLIENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(clients, f, ensure_ascii=False, indent=2)
        logger.info(f"📈 Contador de pedidos aprobados de {phone_key} incrementado a {clients[phone_key]['total_pedidos_aprobados']}.")
        return clients[phone_key]['total_pedidos_aprobados']
    except Exception as e:
        logger.error(f"Error incrementando contador en {CLIENTS_FILE}: {e}")
        return 0

def get_client_data(phone: str) -> dict:
    """Obtiene los datos guardados del cliente según su número de teléfono."""
    clients = load_clients()
    phone_key = _clean_phone(phone)
    return clients.get(phone_key, None)

def get_client_delivery_cost(phone: str, standard_cost: float) -> float:
    """
    Aplica tarifas personalizadas o descuentos silenciosos de delivery si el cliente las tiene configuradas en clientes.json.
    - costo_delivery_fijo: Asigna un precio fijo directo (ej. 2.50).
    - descuento_delivery: Aplica un porcentaje de descuento (ej. 0.50 para 50%).
    """
    if standard_cost is None or standard_cost == -1:
        return standard_cost
    client = get_client_data(phone)
    if not client:
        return standard_cost
    if "costo_delivery_fijo" in client and client["costo_delivery_fijo"] is not None:
        return float(client["costo_delivery_fijo"])
    if "descuento_delivery" in client and client["descuento_delivery"] is not None:
        desc = float(client["descuento_delivery"])
        return round(float(standard_cost) * (1.0 - desc), 2)
    return standard_cost
