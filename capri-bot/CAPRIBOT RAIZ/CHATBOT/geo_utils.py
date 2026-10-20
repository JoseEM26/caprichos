import json
import os
from shapely.geometry import shape, Point

def load_zones(filepath="LIMITES_DELIVERY.geojson"):
    """Carga el archivo GeoJSON de zonas."""
    if not os.path.exists(filepath):
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def calculate_delivery_cost(lat, lon, filepath="LIMITES_DELIVERY.geojson"):
    """
    Toma una latitud y longitud, revisa en qué polígono cae,
    y devuelve el costo del delivery basado en la propiedad 'zona'.
    Retorna:
      - int: El costo en soles (ej. 2, 3, 4)
      - 3: Si está fuera de todas las zonas (Asume Z3 por ahora para pruebas)
      - None: Si no existe el archivo zonas.geojson
    """
    geojson_data = load_zones(filepath)
    if not geojson_data:
        return None
    
    # Shapely y GeoJSON usan (longitud, latitud)
    punto = Point(lon, lat)
    
    for feature in geojson_data.get('features', []):
        polygon = shape(feature['geometry'])
        if polygon.contains(punto):
            props = feature.get('properties') or {}
            # Buscamos la propiedad 'zona', 'costo', 'precio', 'Name' o 'name'
            zona_name = props.get('zona') or props.get('costo') or props.get('precio') or props.get('Name') or props.get('name') or ''
            zona_str = str(zona_name).strip().upper()
            
            # Si se llama 'Z2' o '2', el costo es 2
            if zona_str.startswith('Z') and zona_str[1:].isdigit():
                return int(zona_str[1:])
            elif zona_str.isdigit():
                return int(zona_str)
            elif zona_str.replace('.', '', 1).isdigit():
                return int(float(zona_str))
                
            return 3  # Si está dentro del polígono de límites, costo estándar S/ 3
    
    # Si no cae en ninguna zona del archivo de límites, está fuera de la cobertura de reparto (-1)
    return -1

