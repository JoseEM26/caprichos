import pandas as pd
import os

EXCEL_URL = "https://docs.google.com/spreadsheets/d/1nuRufNHDsrLlexy8hv8caczEUGuML_vNqwcqCBvB4oo/export?format=xlsx"
OUTPUT_FILE = "menu_dinamico.txt"

def descargar_y_formatear_menu():
    print("Descargando la carta desde Google Sheets...")
    try:
        xls = pd.ExcelFile(EXCEL_URL)
        hojas = xls.sheet_names
        
        menu_texto = "**CARTA / MENÚ DE CAPRICHOS (SINCRONIZADA)**\n\n"
        
        # Ignoramos la hoja 'PRODUCTOS' si existe, porque parece un índice general
        for hoja in hojas:
            if hoja.upper() == 'PRODUCTOS':
                continue
                
            df = pd.read_excel(xls, sheet_name=hoja)
            
            # Filtramos solo los que están disponibles si existe la columna
            if 'Disponible' in df.columns:
                df = df[df['Disponible'].astype(str).str.strip().str.upper() == 'SI']
            elif 'DISPONIBLE' in df.columns:
                df = df[df['DISPONIBLE'].astype(str).str.strip().str.upper() == 'SI']
                
            menu_texto += f"**{hoja.upper()}**\n"
            
            # Formateo dinámico según las columnas que encuentre
            for index, row in df.iterrows():
                # Obtenemos nombre del producto o extra
                if 'PRODUCTO' in df.columns:
                    nombre = str(row['PRODUCTO']).strip()
                elif 'ADICIONAL' in df.columns:
                    nombre = str(row['ADICIONAL']).strip()
                else:
                    continue # No sabemos qué es
                    
                if pd.isna(nombre) or nombre == 'nan':
                    continue
                    
                # Buscamos columnas de precios
                precios = []
                # Para bebidas (Regular, Grande, Extra)
                if 'PRECIO REGULAR 14 OZ' in df.columns and pd.notna(row['PRECIO REGULAR 14 OZ']):
                    precios.append(f"Regular: S/ {row['PRECIO REGULAR 14 OZ']}")
                if 'PRECIO GRANDE 16 OZ' in df.columns and pd.notna(row['PRECIO GRANDE 16 OZ']):
                    precios.append(f"Grande: S/ {row['PRECIO GRANDE 16 OZ']}")
                if 'PRECIO GRANDE 16OZ' in df.columns and pd.notna(row['PRECIO GRANDE 16OZ']):
                    precios.append(f"Grande: S/ {row['PRECIO GRANDE 16OZ']}")
                if 'PRECIO EXTRA 20OZ' in df.columns and pd.notna(row['PRECIO EXTRA 20OZ']):
                    precios.append(f"Extra: S/ {row['PRECIO EXTRA 20OZ']}")
                    
                # Para Waffles (Entero, Mitad)
                if 'PRECIO ENTERO' in df.columns and pd.notna(row['PRECIO ENTERO']):
                    precios.append(f"Entero: S/ {row['PRECIO ENTERO']}")
                if 'PRECIO MITAD' in df.columns and pd.notna(row['PRECIO MITAD']):
                    precios.append(f"Mitad: S/ {row['PRECIO MITAD']}")
                    
                # Precio único genérico
                if 'PRECIO' in df.columns and pd.notna(row['PRECIO']):
                    precios.append(f"S/ {row['PRECIO']}")
                
                # Descripción o contenido extra
                desc = ""
                if 'DESCRIPCIÓN' in df.columns and pd.notna(row['DESCRIPCIÓN']):
                    desc = f" ({str(row['DESCRIPCIÓN'])})"
                elif 'DESCRIPCION' in df.columns and pd.notna(row['DESCRIPCION']):
                    desc = f" ({str(row['DESCRIPCION'])})"
                elif 'CONTENIDO ' in df.columns and pd.notna(row['CONTENIDO ']):
                    desc = f" ({str(row['CONTENIDO '])})"

                # Perfeccionar descripción completa de Combos Dúo
                if "DUO COMPARTIR" in nombre.upper() or "DÚO COMPARTIR" in nombre.upper():
                    desc = " (2 Bebidas frías o calientes a tu elección excepto bebidas frozen + 1 Complemento a elegir entre: 2 Donas, 2 Galletas Choco Chips, 1 Dona + 1 Galleta, 1 Carrot Cake, 1 Keke Marmoleado, 1 Empanada de jamón y queso o pollo casero, o 1 Bandeja de 4 Petit Pan)"
                elif "DUO IRRESISTIBLE" in nombre.upper() or "DÚO IRRESISTIBLE" in nombre.upper():
                    desc = " (Club Sándwich gigante de 4 pisos + 350g de papas nativas + 2 Bebidas a elegir: Americano, Cappuccino, Chocolate, Iced Coffee, Iced Latte Coffee o Iced Chocolate)"
                    
                precios_str = " | ".join(precios)
                menu_texto += f"- {nombre}: {precios_str}{desc}\n"
                
            if hoja.upper() == "COMBOS" and "CAPRIKIDS" not in menu_texto.upper():
                menu_texto += "- COMBO CAJITA CAPRIKIDS: S/ 27.0 (Frappé Oreo 12 oz + Nuggets artesanales + Papas nativas mini con Salchichas ahumadas + 2 Juguetes a elección: Pistola de burbujas, Burbujas o Squishy. Para niño o niña. Válido para salón y delivery)\n"
                
            if hoja.upper() == "POSTRES":
                if "TORTA DE CHOCOLATE" not in menu_texto.upper():
                    menu_texto += "- Torta de chocolate: S/ 9.5\n"
                if "CREMA VOLTEADA" not in menu_texto.upper():
                    menu_texto += "- Crema volteada: S/ 9.5\n"
                if "PIE DE LIMON" not in menu_texto.upper() and "PIE DE LIMÓN" not in menu_texto.upper():
                    menu_texto += "- Pie de limón: S/ 7.5\n"
                if "TARTALETA DE MIX DE FRUTAS" not in menu_texto.upper():
                    menu_texto += "- Tartaleta de mix de frutas: S/ 7.5\n"

            menu_texto += "\n"
            
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(menu_texto)
            
        print("¡Carta sincronizada y guardada en menu_dinamico.txt!")
        return menu_texto
        
    except Exception as e:
        print(f"Error al descargar la carta: {e}")
        return None

if __name__ == "__main__":
    descargar_y_formatear_menu()
