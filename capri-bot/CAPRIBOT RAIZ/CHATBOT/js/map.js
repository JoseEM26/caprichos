/**
 * CAPRICHOS - MAPA INTERACTIVO CON GOOGLE MAPS / LEAFLET
 * Detección de GPS, Geocodificación, Polígonos de reparto y cálculo de tarifa
 */

class DeliveryMapManager {
  constructor() {
    this.map = null;
    this.storeMarker = null;
    this.userMarker = null;
    this.zonesLayer = null;
    this.currentLat = CAPRICHOS_STORE_LOCATION.lat;
    this.currentLng = CAPRICHOS_STORE_LOCATION.lng;
    this.currentZone = null;
    this.isInitialized = false;
  }

  init(containerId = "delivery-map") {
    if (this.isInitialized || !document.getElementById(containerId)) {
      return;
    }

    if (typeof L === "undefined") {
      console.warn("Leaflet no está cargado aún en la página.");
      return;
    }

    // Coordenadas centrales de Caprichos
    const initialLat = -12.0188;
    const initialLng = -76.9645;

    // Inicializar mapa de Leaflet
    this.map = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false // Para evitar que se quede atrapado en scroll en móviles
    }).setView([initialLat, initialLng], 14);

    // Tiles elegantes de OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.map);

    // 1. Icono personalizado de la Tienda Caprichos
    const storeIcon = L.divIcon({
      className: "custom-map-icon store-icon",
      html: `<div class="store-pin-badge">☕ Caprichos</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    this.storeMarker = L.marker([initialLat, initialLng], {
      icon: storeIcon,
      title: "Caprichos Cafetería & Pastelería"
    }).addTo(this.map);

    this.storeMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; text-align: center;">
        <strong style="color: #b45309;">☕ Caprichos Cafetería</strong><br/>
        <span>Horario: 2:00 pm - 10:00 pm</span><br/>
        <small style="color: #6b7280;">¡Aquí preparamos tus delicias!</small>
      </div>
    `);

    // 2. Dibujar polígonos de zonas de reparto desde CAPRICHOS_GEOJSON
    if (typeof CAPRICHOS_GEOJSON !== "undefined") {
      this.zonesLayer = L.geoJSON(CAPRICHOS_GEOJSON, {
        style: (feature) => {
          const props = feature.properties || {};
          return {
            color: props.color || "#b45309",
            weight: 2,
            opacity: 0.8,
            fillColor: props.color || "#f59e0b",
            fillOpacity: 0.15,
            dashArray: "4, 4"
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          layer.bindTooltip(`📍 ${props.nombre || props.zona} (Envío: S/ ${props.costo}.00)`, {
            permanent: false,
            direction: "center"
          });
        }
      }).addTo(this.map);
    }

    // 3. Marcador del Cliente (Arrastrable)
    const userIcon = L.divIcon({
      className: "custom-map-icon user-icon",
      html: `<div class="user-pin-badge"><span class="pin-pulse"></span>📍 Entrega</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 42]
    });

    // Colocar el marcador inicial a corta distancia
    const userStartLat = initialLat + 0.002;
    const userStartLng = initialLng + 0.002;

    this.userMarker = L.marker([userStartLat, userStartLng], {
      draggable: true,
      icon: userIcon,
      title: "Arrastra para fijar tu dirección"
    }).addTo(this.map);

    this.currentLat = userStartLat;
    this.currentLng = userStartLng;

    // Eventos del marcador
    this.userMarker.on("dragend", (e) => {
      const position = e.target.getLatLng();
      this.handleLocationChanged(position.lat, position.lng, true);
    });

    // Clic en el mapa para mover el pin
    this.map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      this.userMarker.setLatLng([lat, lng]);
      this.handleLocationChanged(lat, lng, true);
    });

    // Evaluar la posición inicial
    this.handleLocationChanged(userStartLat, userStartLng, false);
    this.isInitialized = true;

    // Ajustar vista cuando el contenedor se hace visible
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 400);
  }

  handleLocationChanged(lat, lng, fetchAddress = true) {
    this.currentLat = lat;
    this.currentLng = lng;

    // Evaluar zona de reparto
    const zoneResult = evaluateDeliveryLocation(lat, lng);
    this.currentZone = zoneResult;

    // Actualizar carrito con la nueva zona
    if (window.cart) {
      window.cart.setDeliveryZone(zoneResult);
    }

    // Actualizar UI
    this.updateUIStatus(zoneResult, lat, lng);

    // Opcional: Obtener dirección aproximada con Nominatim
    if (fetchAddress) {
      this.reverseGeocode(lat, lng);
    }
  }

  updateUIStatus(zoneResult, lat, lng) {
    const statusBox = document.getElementById("zone-status-card");
    const gmapsLink = document.getElementById("gmaps-external-link");
    const coordsDisplay = document.getElementById("coords-display");

    if (coordsDisplay) {
      coordsDisplay.innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    if (gmapsLink) {
      gmapsLink.href = `https://maps.google.com/?q=${lat},${lng}`;
      gmapsLink.target = "_blank";
    }

    if (statusBox) {
      if (zoneResult.inside) {
        statusBox.className = "status-card inside-zone";
        statusBox.innerHTML = `
          <div class="status-icon">🛵</div>
          <div class="status-content">
            <span class="status-badge" style="background: ${zoneResult.color || '#10b981'}; color: white;">
              ${zoneResult.zona} • S/ ${zoneResult.costo.toFixed(2)}
            </span>
            <p class="status-text">${zoneResult.mensaje}</p>
          </div>
        `;
      } else {
        statusBox.className = "status-card outside-zone";
        statusBox.innerHTML = `
          <div class="status-icon">⚠️</div>
          <div class="status-content">
            <span class="status-badge" style="background: #6b7280; color: white;">
              Fuera de Cobertura Directa
            </span>
            <p class="status-text">${zoneResult.mensaje}</p>
          </div>
        `;
      }
    }
  }

  async reverseGeocode(lat, lng) {
    const addrInput = document.getElementById("client-address");
    if (!addrInput || (addrInput.value && addrInput.dataset.manual === "true")) {
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "es" } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(",");
          // Mostrar las primeras 2 o 3 partes (calle, número, barrio)
          const shortAddr = parts.slice(0, 3).join(",").trim();
          if (shortAddr && (!addrInput.value || addrInput.dataset.manual !== "true")) {
            addrInput.value = shortAddr;
          }
        }
      }
    } catch (err) {
      console.warn("Geocodificación reversa no disponible:", err);
    }
  }

  useCurrentGPS() {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta la detección de ubicación GPS.");
      return;
    }

    const gpsBtn = document.getElementById("btn-use-gps");
    const origText = gpsBtn ? gpsBtn.innerHTML : "";
    if (gpsBtn) {
      gpsBtn.disabled = true;
      gpsBtn.innerHTML = `<span class="spinner-inline"></span> Detectando GPS...`;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (this.map && this.userMarker) {
          this.userMarker.setLatLng([lat, lng]);
          this.map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
          this.handleLocationChanged(lat, lng, true);
        }

        if (gpsBtn) {
          gpsBtn.disabled = false;
          gpsBtn.innerHTML = origText;
        }

        if (window.showToast) {
          window.showToast("📍 ¡Ubicación GPS fijada en el mapa!");
        }
      },
      (err) => {
        if (gpsBtn) {
          gpsBtn.disabled = false;
          gpsBtn.innerHTML = origText;
        }
        let msg = "No se pudo obtener tu ubicación actual.";
        if (err.code === 1) {
          msg = "Permiso de ubicación denegado. Puedes arrastrar el pin manualmente en el mapa.";
        }
        alert(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  getLocationData() {
    return {
      lat: this.currentLat,
      lng: this.currentLng,
      zone: this.currentZone,
      gmapsUrl: `https://maps.google.com/?q=${this.currentLat},${this.currentLng}`
    };
  }
}

// Instancia global del mapa
window.deliveryMap = new DeliveryMapManager();
