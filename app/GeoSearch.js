'use client'
import { useState, useRef, useCallback } from 'react'
import g from './GeoSearch.module.css'

const GEO_API = 'https://geo.api.gouv.fr'

// ── Recherche communes par nom ─────────────────────────────────────────────
async function rechercherCommunes(nom) {
  const url = `${GEO_API}/communes?nom=${encodeURIComponent(nom)}&fields=nom,codesPostaux,centre&boost=population&limit=10`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Communes dans un rayon autour de lat/lon ───────────────────────────────
// async function communesAutour(lat, lon, rayonKm) {
  // const url = `${GEO_API}/communes?lat=${lat}&lon=${lon}&distance=${rayonKm * 1000}&fields=nom,codesPostaux&limit=200`
  // const res = await fetch(url)
  // if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // return res.json()
// }


// début modif

// Distance entre 2 points GPS (km)
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Chargement des communes avec coordonnées GPS
// async function chargerCommunes() {
  // const res = await fetch(
    // `${GEO_API}/communes?fields=nom,code,centre,population&format=json`
  // )

  // if (!res.ok) {
    // throw new Error(`HTTP ${res.status}`)
  // }

  // return res.json()
// }
let cacheCommunes = null

async function chargerCommunes() {
  if (cacheCommunes) return cacheCommunes

  const res = await fetch(
    `${GEO_API}/communes?fields=nom,codesPostaux,centre,population&format=json`
  )

  cacheCommunes = await res.json()
  return cacheCommunes
}

// Recherche des communes dans un rayon donné
async function communesAutour(lat, lon, rayonKm) {
  const communes = await chargerCommunes()
  

// console.log("Nb communes :", communes.length)
// communes.slice(0, 5).forEach(c =>
  // console.log(c.nom)
// )
// console.log("GPS utilisateur :", lat, lon)

// const test = communes[0]

// const [lng, latCommune] = test.centre.coordinates

// console.log(
  // test.nom,
  // latCommune,
  // lng,
  // distanceKm(lat, lon, latCommune, lng)
// )
//  return communes
    // .filter(c => {
      // const coords = c.centre?.coordinates
      // if (!coords) return false

      // const [lng, latCommune] = coords

      // return (
        // distanceKm(lat, lon, latCommune, lng) <= rayonKm
      // )
    // })
    // .sort((a, b) => b.population - a.population)
//}
	const resultat = communes.filter(c => {
    const coords = c.centre?.coordinates
    if (!coords) return false

    const [lng, latCommune] = coords

    return (
      distanceKm(lat, lon, latCommune, lng) <= rayonKm
    )
  })

  console.log("Communes trouvées :", resultat.length)

  resultat.slice(0, 20).forEach(c => {
    console.log(c.nom, "CP ", c.codePostaux)
  })

  return resultat
}


// fin modif




// ── Composant ──────────────────────────────────────────────────────────────
export default function GeoSearch({ onApply }) {
  // Recherche par nom
  const [nomQuery,    setNomQuery]    = useState('')
  const [suggestions, setSuggestions] = useState([])  // résultats de recherche
  const [commune,     setCommune]     = useState(null) // commune pivot sélectionnée
  const [searching,   setSearching]   = useState(false)
  const [searchErr,   setSearchErr]   = useState(null)

  // Rayon
  const [rayon, setRayon] = useState(10)  // km

  // Communes du rayon
  const [communesRayon, setCommunesRayon] = useState([])  // liste complète
  const [selection,     setSelection]     = useState([])  // codes postaux cochés
  const [geoLoading,    setGeoLoading]    = useState(false)
  const [geoErr,        setGeoErr]        = useState(null)

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsErr,     setGpsErr]     = useState(null)
  const [gpsPos,     setGpsPos]     = useState(null)

  const debounceRef = useRef(null)

  // ── Recherche par nom (debounce 400ms) ─────────────────────────────────
  function handleNomChange(e) {
    const val = e.target.value
    setNomQuery(val)
    setCommune(null)
    setSuggestions([])
    setSearchErr(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) return
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await rechercherCommunes(val)
        setSuggestions(res)
      } catch (e) {
        setSearchErr(e.message)
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  // ── Sélection d'une commune pivot ───────────────────────────────────────
  function choisirCommune(c) {
    setCommune(c)
    setNomQuery(`${c.nom} (${c.codesPostaux?.[0] ?? ''})`)
    setSuggestions([])
    setCommunesRayon([])
    setSelection([])
    setGpsPos(null)
    setGeoErr(null)
  }

  // ── Charger les communes dans le rayon ─────────────────────────────────
  const chargerRayon = useCallback(async (lat, lon, r) => {
    setGeoLoading(true); setGeoErr(null)
    try {
      const res = await communesAutour(lat, lon, r)
	  console.log(res)
      // Dédoublonner les codes postaux
      const seen = new Set()
      const liste = []
      // for (const c of res) {
        // for (const cp of (c.codesPostaux || [])) {
          // if (!seen.has(cp)) {
            // seen.add(cp)
            // liste.push({ cp, nom: c.nom })
          // }
        // }
      // }
		for (const c of res) {
			const cps = c.codesPostaux ?? []
            console.log("Nombre de code Postaux",cps.length)
			if (cps.length === 0) {
			// fallback sécurité
				liste.push({ cp: c.code, nom: c.nom })
			} else {
				for (const cp of cps) {
				if (!seen.has(cp)) {
				seen.add(cp)
				liste.push({ cp, nom: c.nom })
		}
    }
  }
}
      liste.sort((a, b) => a.cp.localeCompare(b.cp))
      setCommunesRayon(liste)
	  console.log(liste)
      setSelection(liste.map(x => x.cp))  // tout coché par défaut
	  
    } catch (e) {
      setGeoErr(e.message)
    } finally {
      setGeoLoading(false)
    }
  }, [])

  // ── Bouton "Chercher autour" ────────────────────────────────────────────
  function lancerRecherche() {
    const pivot = gpsPos || commune
    if (!pivot) return
    const lat = gpsPos ? gpsPos.lat : commune.centre.coordinates[1]
    const lon = gpsPos ? gpsPos.lon : commune.centre.coordinates[0]
    chargerRayon(lat, lon, rayon)
  }

  // ── GPS ─────────────────────────────────────────────────────────────────
  function maPosition() {
    setGpsLoading(true); setGpsErr(null)
    setCommune(null); setNomQuery(''); setSuggestions([])
    setCommunesRayon([]); setSelection([])
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setGpsPos(p)
        setGpsLoading(false)
        chargerRayon(p.lat, p.lon, rayon)
      },
      err => {
        setGpsErr('Géolocalisation refusée ou indisponible.')
        setGpsLoading(false)
      },
      { timeout: 10000 }
    )
  }

  // ── Recalculer quand le rayon change (si pivot déjà choisi) ────────────
  function changerRayon(newR) {
    setRayon(newR)
    const lat = gpsPos ? gpsPos.lat : commune?.centre?.coordinates?.[1]
    const lon = gpsPos ? gpsPos.lon : commune?.centre?.coordinates?.[0]
    if (lat && lon) chargerRayon(lat, lon, newR)
  }

  // ── Toggle une commune dans la sélection ───────────────────────────────
  function toggleCp(cp) {
    setSelection(sel =>
      sel.includes(cp) ? sel.filter(x => x !== cp) : [...sel, cp]
    )
  }
  function toutCocher()    { setSelection(communesRayon.map(x => x.cp)) }
  function toutDecocher()  { setSelection([]) }

  // ── Appliquer la sélection ──────────────────────────────────────────────
  // function appliquer() {
    // if (selection.length === 0) return
    // onApply(selection)
  // }

// ── Appliquer la sélection ──────────────────────────────────────────────
  function appliquer() {
    if (selection.length === 0) return
    // Déterminer le pivot utilisé pour cette recherche
    let pivot = null
    if (gpsPos) {
      pivot = { lat: gpsPos.lat, lon: gpsPos.lon, type: 'gps' }
    } else if (commune?.centre?.coordinates) {
      pivot = {
        lat: commune.centre.coordinates[1],
        lon: commune.centre.coordinates[0],
        type: 'commune',
        nom: commune.nom,
      }
    }
    onApply(selection, pivot)
  }

  const hasPivot = !!(commune || gpsPos)

  return (
    <div className={g.panel}>
      <div className={g.panelTitle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        Recherche géographique
      </div>

      {/* ── Ligne 1 : nom commune + GPS ── */}
      <div className={g.row1}>
        <div className={g.searchBox}>
          <input
            className={g.inp}
            type="text"
            value={nomQuery}
            onChange={handleNomChange}
            placeholder="Nom de commune..."
          />
          {searching && <span className={g.spin} />}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <ul className={g.suggestions}>
              {suggestions.map((s, i) => (
                <li key={i} className={g.suggestion} onClick={() => choisirCommune(s)}>
                  <span className={g.sugNom}>{s.nom}</span>
                  <span className={g.sugCp}>{s.codesPostaux?.join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
          {searchErr && <p className={g.err}>{searchErr}</p>}
        </div>

        <button className={g.btnGps} onClick={maPosition} disabled={gpsLoading}
          title="Utiliser ma position GPS">
          {gpsLoading
            ? <span className={g.spin} />
            : <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <circle cx="12" cy="12" r="8" strokeDasharray="3 2"/>
              </svg>
          }
          Ma position
        </button>
      </div>

      {gpsErr && <p className={g.err}>{gpsErr}</p>}

      {/* ── Pivot affiché ── */}
      {gpsPos && !commune && (
        <div className={g.pivotBadge}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--acc)">
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Position GPS : {gpsPos.lat.toFixed(4)}, {gpsPos.lon.toFixed(4)}
        </div>
      )}

      {/* ── Rayon ── */}
      <div className={g.rayonRow}>
        <span className={g.rayonLabel}>Rayon :</span>
        {[5, 10, 20, 50].map(r => (
          <button key={r}
            className={[g.rayonBtn, rayon === r && g.rayonOn].filter(Boolean).join(' ')}
            onClick={() => changerRayon(r)}>
            {r} km
          </button>
        ))}
        {hasPivot && (
          <button className={g.btnChercher} onClick={lancerRecherche} disabled={geoLoading}>
            {geoLoading ? <span className={g.spin} /> : '🔍'} Chercher communes voisines
          </button>
        )}
      </div>

      {geoErr && <p className={g.err}>{geoErr}</p>}

      {/* ── Liste des communes ── */}
      {communesRayon.length > 0 && (
        <>
          <div className={g.listHeader}>
            <span className={g.listCount}>
              {communesRayon.length} communes trouvées
              {' · '}{selection.length} sélectionnées
            </span>
            <button className={g.selBtn} onClick={toutCocher}>Tout</button>
            <button className={g.selBtn} onClick={toutDecocher}>Aucun</button>
          </div>

          <div className={g.communeList}>
            {communesRayon.map(({ cp, nom }) => (
              <label key={cp} className={g.communeLine}>
                <input type="checkbox"
                  className={g.chk}
                  checked={selection.includes(cp)}
                  onChange={() => toggleCp(cp)} />
                <span className={g.communeCp}>{cp}</span>
                <span className={g.communeNom}>{nom}</span>
              </label>
            ))}
          </div>

          <button
            className={g.btnApply}
            onClick={appliquer}
            disabled={selection.length === 0}>
			Rechercher les stations ( dans {selection.length} communes)
          </button>
        </>
      )}
    </div>
  )
}
