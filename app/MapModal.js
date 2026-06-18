'use client'
import { useEffect, useRef } from 'react'
import s from './MapModal.module.css'

const STATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52">
  <path d="M20 0C8.95 0 0 8.95 0 20c0 15 20 32 20 32S40 35 40 20C40 8.95 31.05 0 20 0z" fill="#f5a623"/>
  <circle cx="20" cy="20" r="11" fill="#0c0e13"/>
  <rect x="13" y="14" width="14" height="10" rx="2" fill="#f5a623"/>
  <rect x="16" y="24" width="8" height="3" fill="#f5a623"/>
  <circle cx="27" cy="16" r="3" fill="#e8921a"/>
  <line x1="27" y1="16" x2="27" y2="22" stroke="#e8921a" stroke-width="1.5"/>
</svg>`

const ICON_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(STATION_SVG)}`

// ── URL Waze vers une destination GPS ────────────────────────────────────────
// Sur mobile : ouvre l'appli Waze directement
// Sur desktop : ouvre Waze Web
function wazeUrl(lat, lon) {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
}

export default function MapModal({ station, onClose }) {
  const mapRef  = useRef(null)
  const mapInst = useRef(null)

  const lat = station.latitude  ? parseFloat(station.latitude)  / 100000 : null
  const lon = station.longitude ? parseFloat(station.longitude) / 100000 : null
  const hasCoords = lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)

  useEffect(() => {
    if (!hasCoords || !mapRef.current) return

    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !mapRef.current) return
      const Lf = L.default

      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
      if (mapRef.current._leaflet_id) delete mapRef.current._leaflet_id

      const map = Lf.map(mapRef.current, { center: [lat, lon], zoom: 15, zoomControl: true })

      Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const icon = Lf.icon({
        iconUrl: ICON_URL, iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -56],
      })

      Lf.marker([lat, lon], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:'Syne',sans-serif;min-width:150px">
            <div style="font-weight:700;font-size:.95rem;margin-bottom:.3rem">${station.ville}</div>
            <div style="font-size:.82rem;color:#828aa8;margin-bottom:.3rem">${station.adresse}</div>
            <div style="font-size:.75rem;color:#4e5672">${station.cp}</div>
          </div>
        `)
        .openPopup()

      mapInst.current = map
    })

    return () => {
      cancelled = true
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>

        {/* ── En-tête ── */}
        <div className={s.modalHeader}>
          <div className={s.modalInfo}>
            <span className={s.modalVille}>{station.ville}</span>
            <span className={s.modalAddr}>{station.adresse} &mdash; {station.cp}</span>
          </div>
          <div className={s.modalActions}>
            {/* Bouton Waze */}
            {hasCoords && (
              <a
                href={wazeUrl(lat, lon)}
                target="_blank"
                rel="noopener noreferrer"
                className={s.wazeBtn}
				style={{ color: '#87CEEB', fontSize: '2rem' }}
                title="Ouvrir l'itinéraire dans Waze"
                onClick={e => e.stopPropagation()}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="lightblue">
                  <path d="M12 1C6.48 1 2 5.48 2 11c0 3.69 1.97 6.93 4.93 8.75L6 22l3.14-1.04C10.02 21.3 11 21.5 12 21.5c5.52 0 10-4.48 10-10S17.52 1 12 1zm1 13.5h-2v-2h2v2zm0-4h-2V7h2v3.5z"/>
                </svg>
                Waze
              </a>
            )}
            <button className={s.closeBtn} onClick={onClose} aria-label="Fermer">&#10005;</button>
          </div>
        </div>

        {/* ── Carte ── */}
        <div className={s.mapWrap}>
          {hasCoords
            ? <div ref={mapRef} className={s.map} />
            : <div className={s.noCoords}>Coordonn&eacute;es GPS non disponibles.</div>
          }
        </div>

      </div>
    </div>
  )
}
