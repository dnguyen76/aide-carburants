'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import c from './page.module.css'
import GeoSearch from './GeoSearch'

const MapModal = dynamic(() => import('./MapModal'), { ssr: false })

const CP_76  = []
const CP_56  = []
const LS_KEY = 'carbu_codes_76'

const API_BASE =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets' +
  '/prix-des-carburants-en-france-flux-instantane-v2/records'

useEffect(() => {
  console.log('>>> Page MONTÉE')
  return () => console.log('>>> Page DÉMONTÉE')
}, [])

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


// ── localStorage ──────────────────────────────────────────────────────────────
function lireCodesLocaux() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 &&
        parsed.every(c => /^\d{5}$/.test(c))) return parsed
  } catch {}
  return null
}
function sauvegarderCodes(codes) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(codes)) } catch {}
}

// ── Fetch stations ─────────────────────────────────────────────────────────────
async function fetchStations(codes) {
  const cpList = codes.map(x => `"${x}"`).join(',')
  const params = new URLSearchParams({
    where:    `cp IN (${cpList})`,
    limit:    '100',
    order_by: 'e10_prix ASC',
  })
  const res = await fetch(`${API_BASE}?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const toF = v => (v != null && v !== '') ? parseFloat(v) : null
  return (data.results || []).map(r => ({
    id:          String(r.id ?? ''),
    adresse:     r.adresse ?? '',
    cp:          String(r.cp ?? '').trim(),
    ville:       String(r.ville ?? '').toUpperCase(),
    latitude:    r.latitude ?? null,
    longitude:   r.longitude ?? null,
    e10_prix:    toF(r.e10_prix),
    e10_maj:     r.e10_maj ?? null,
    e10_rupture: r.e10_rupture_debut ?? null,
    sp95_prix:   toF(r.sp95_prix),
    sp98_prix:   toF(r.sp98_prix),
    gazole_prix: toF(r.gazole_prix),
    e85_prix:    toF(r.e85_prix),
  }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = p => p != null ? p.toFixed(3).replace('.', ',') + '\u00A0€' : '—'
const fmtD = iso => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// ── Carte station ─────────────────────────────────────────────────────────────
function Card({ st, rank, isMin, isMax, fuel, onMapClick, userPos }) {
  const [open, setOpen] = useState(false)
  const prix     = fuel === 'gazole' ? st.gazole_prix : st.e10_prix
  const rupture  = fuel === 'gazole' ? null : st.e10_rupture
  const majDate  = fuel === 'gazole' ? null : st.e10_maj
  const label    = fuel === 'gazole' ? 'GAZOLE' : 'E10'
  const colorVar = fuel === 'gazole' ? 'var(--dsl)' : 'var(--acc)'
  const rupt     = !!(rupture?.length)
  const noFuel   = prix == null
  const cls      = [c.card, isMin && c.cMin, isMax && c.cMax, (rupt || noFuel) && c.cRup]
    .filter(Boolean).join(' ')

  // Distance à la position courante
  const lat = st.latitude  ? parseFloat(st.latitude)  / 100000 : null
  const lon = st.longitude ? parseFloat(st.longitude) / 100000 : null
  const dist = (userPos && lat != null && lon != null && !isNaN(lat) && !isNaN(lon))
    ? distanceKm(userPos.lat, userPos.lon, lat, lon)
    : null

  return (
    <div className={cls}
      onClick={e => { if (!e.target.closest('[data-map]')) setOpen(v => !v) }}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && setOpen(v => !v)}>
      <div className={c.row}>
        <span className={c.rank}>#{rank}</span>
        <div className={c.info}>
          <div className={c.nameLine}>
            <span className={c.cpTag}>{st.cp}</span>
            <span className={c.ville}>{st.ville}</span>
          </div>
		 <div className={c.addr}>
			{st.adresse}
			{dist != null && <span className={c.dist}> · {dist.toFixed(1)} km</span>}
		</div> 
        </div>
        <div className={c.priceBox}>
          {rupt ? <span className={c.ruptTxt}>RUPTURE</span>
            : noFuel ? <span className={c.ruptTxt}>{label} N/D</span>
            : <>
                <span className={c.price} style={{
                  color: isMin ? 'var(--grn)' : isMax ? 'var(--red)' : colorVar
                }}>{fmt(prix)}</span>
                <span className={c.fuelLbl}>{label} / L</span>
              </>}
          {isMin && <span className={c.badge} style={{ background: 'var(--grn)' }}>MIN</span>}
          {isMax && <span className={c.badge} style={{ background: 'var(--red)' }}>MAX</span>}
        </div>
        <button data-map="1" className={c.mapBtn}
          onClick={e => { e.stopPropagation(); onMapClick(st) }}
          title="Voir sur la carte" aria-label="Carte">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        </button>
        <span className={c.chev}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className={c.detail}>
          <div className={c.chips}>
            {[['E10', st.e10_prix], ['SP95', st.sp95_prix], ['SP98', st.sp98_prix],
              ['Gazole', st.gazole_prix], ['E85', st.e85_prix]]
              .filter(([, p]) => p != null)
              .map(([lbl, p]) => (
                <div key={lbl} className={[c.chip, lbl === label ? c.chipHL : ''].join(' ')}>
                  <span className={c.chipL}>{lbl}</span>
                  <span className={c.chipV}>{fmt(p)}</span>
                </div>
              ))}
          </div>
          {majDate && <p className={c.maj}>MAJ {label} : {fmtD(majDate)}</p>}
        </div>
      )}
    </div>
  )
}


// ── Switch 2 positions ────────────────────────────────────────────────────────
function Switch({ labelA, labelB, value, onChange, colorB }) {
  return (
    <div className={c.switchWrap}>
      <span className={[c.switchLabel, !value && c.switchLabelOn].join(' ')}
        onClick={() => onChange(false)} style={!value ? {} : { cursor: 'pointer' }}>
        {labelA}
      </span>
      <button
        className={[c.switchTrack, value && c.switchTrackOn].filter(Boolean).join(' ')}
        onClick={() => onChange(!value)}
        style={value ? { '--sw-color': colorB || 'var(--acc)' } : {}}
        role="switch" aria-checked={value}>
        <span className={[c.switchThumb, value && c.switchThumbOn].filter(Boolean).join(' ')} />
      </button>
      <span className={[c.switchLabel, value && c.switchLabelOn].join(' ')}
        style={value ? { color: colorB || 'var(--acc)', cursor: 'default' } : { cursor: 'pointer' }}
        onClick={() => onChange(true)}>
        {labelB}
      </span>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Page() {
//  const [regionB,    setRegionB]   = useState(false)
  const regionB = false
  const [fuelD,      setFuelD]     = useState(false)
  const [codes,      setCodes]     = useState(CP_76)
  const [stations,   setStations]  = useState([])
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState(null)
  const [sort,       setSort]      = useState('prix')
  const [lastFetch,  setLastFetch] = useState(null)
  const [mapStation, setMapStation]= useState(null)
  const [lsInfo,     setLsInfo]    = useState(null)
//  const [userPos, setUserPos] = useState(null) // { lat, lon }
  const [refPos, setRefPos] = useState(null) // { lat, lon, type: 'gps'|'commune', nom? }

  const fuel = fuelD ? 'gazole' : 'e10'

  const load = useCallback(async (cpList) => {
    if (!cpList.length) return
    setLoading(true); setError(null)
    try {
      const data = await fetchStations(cpList)
      setStations(data)
      setLastFetch(new Date())
    } catch (e) {
      setError(e.message); setStations([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Démarrage : lire localStorage ou CP_76 par défaut
  useEffect(() => {
    const saved = lireCodesLocaux()
    if (saved) {
      setCodes(saved)
      setLsInfo(`Codes mémorisés : ${saved.join(', ')}`)
      load(saved)
    }
	// else {
      // load(CP_76)
    // }
  }, [load])

  // Changement de région (pas au montage)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    load(regionB ? CP_56 : codes)
  }, [regionB]) // eslint-disable-line




useEffect(() => {
  // Ne pas demander le GPS si un pivot "commune" est déjà actif
  if (refPos?.type === 'commune') return
  if (!navigator.geolocation) return

  const watchId = navigator.geolocation.watchPosition(
    pos => setRefPos(prev =>
      prev?.type === 'commune' ? prev : { lat: pos.coords.latitude, lon: pos.coords.longitude, type: 'gps' }
    ),
    err => console.warn('Géolocalisation indisponible :', err.message),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  )

  return () => navigator.geolocation.clearWatch(watchId)
}, [refPos?.type])

 function removeCode(cp) {
    const next = codes.filter(x => x !== cp)
    setCodes(next)
    sauvegarderCodes(next)
    setLsInfo(next.length ? `Codes mémorisés : ${next.join(', ')}` : null)
    if (!regionB) next.length ? load(next) : setStations([])
  }


// Callback GeoSearch → appliquer de nouveaux codes + pivot de référence
  function appliquerCodes(newCodes, pivot) {
    const uniq = [...new Set(newCodes)].filter(c => /^\d{5}$/.test(c))
    if (!uniq.length) return
    setCodes(uniq)
    sauvegarderCodes(uniq)
    setLsInfo(`Codes mémorisés : ${uniq.join(', ')}`)
    if (pivot) setRefPos(pivot)
    if (!regionB) load(uniq)
  }

  const getPrix  = s => fuel === 'gazole' ? s.gazole_prix : s.e10_prix
  const avecPrix = stations.filter(s => getPrix(s) != null)
  const prices   = avecPrix.map(s => getPrix(s))
  const minP     = prices.length ? Math.min(...prices) : null
  const maxP     = prices.length ? Math.max(...prices) : null
  const avg      = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null

  const sorted = [...stations].sort((a, b) => {
    if (sort === 'ville') return a.ville.localeCompare(b.ville)
    const pa = getPrix(a), pb = getPrix(b)
    if (pa != null && pb != null) return pa - pb
    if (pa != null) return -1; if (pb != null) return 1; return 0
  })

  return (
    <main className={c.main}>

      <header className={c.hdr}>
        <div className={c.hInner}>
          <div className={c.logo}>
            <span className={c.ico}>&#9981;</span>
            <div>
              <h1 className={c.title}>Prix Carburants</h1>
               {/* <p className={c.title}>
                {regionB ? 'Morbihan (56)' : 'Seine-Maritime (76)'}
                {' \u00b7 '} {fuelD ? 'Gazole' : 'E10'}
              </p>*/}
            </div>
          </div>
          <a href="https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/"
            target="_blank" rel="noopener noreferrer" className={c.srcLink}>
            Minist&egrave;re de l&apos;&Eacute;conomie &middot; Licence Ouverte 2.0
          </a>
        </div>
      </header>

      <div className={c.wrap}>

       {/* ── Switchs ── */}
		{/*
       <div className={c.switchBar}>
          <Switch labelA="Seine-Maritime" labelB="Morbihan"
            value={regionB} onChange={setRegionB} colorB="var(--acc)" />
          <div className={c.switchDivider} />
          <Switch labelA="E10" labelB="Gazole"
            value={fuelD} onChange={setFuelD} colorB="var(--dsl)" />
        </div>
		 */}
		 
		<div className={c.switchBar}>
			<Switch labelA="E10" labelB="Gazole"
			  value={fuelD} onChange={setFuelD} colorB="var(--dsl)" />
		</div>
        {/* ── Codes actifs (affichage + suppression) ── */}
			{ regionB && (
           <div className={c.codesBar}>
            {/* <div className={c.tags}>
              {codes.map(cp => (
                <span key={cp} className={c.tag}>
                  {cp}
                  <button className={c.tagX} onClick={() => removeCode(cp)}
                    aria-label={`Retirer ${cp}`}>&times;</button>
                </span>
              ))}
			  
            </div>
			*/}
            <div className={c.codesActions}>
              <button className={c.btnRef} onClick={() => load(codes)}
                disabled={loading || !codes.length} title="Actualiser">&#8635;</button>
				
              {/*  Suppression bouton Défaut
			 {lsInfo && (
                <button className={c.btnReset} onClick={resetCodes}
                  title="Remettre les codes par défaut">&#8634; Défaut</button>
              )}
			*/}   
            </div>
            {lsInfo && (
              <div className={c.lsInfo}>
                <span className={c.lsIcon}>&#128190;</span>
                {lsInfo}
              </div>
            )}
          </div>
        )}
)
        {/* CP Morbihan */}
        {regionB && (
          <div className={c.bCodes}>
            {CP_56.map(cp => <span key={cp} className={c.tag}>{cp}</span>)}
            <button className={c.btnRef} onClick={() => load(CP_56)}
              disabled={loading} title="Actualiser">&#8635;</button>
          </div>
        )}

        {/* ── Panneau recherche géographique ── */}
        {!regionB && <GeoSearch onApply={appliquerCodes} />}

       {/* ── Stats ── */}
        {!loading && avecPrix.length > 0 && (
          <div className={c.stats}>
            {[
              [avecPrix.length, `stations ${fuelD ? 'Gazole' : 'E10'}`, null],
              [fmt(minP), 'prix min', 'var(--grn)'],
              [fmt(avg),  'moyenne',  fuelD ? 'var(--dsl)' : 'var(--acc)'],
              [fmt(maxP), 'prix max', 'var(--red)'],
            ].map(([v, l, col]) => (
              <div key={l} className={c.stat}>
                <span className={c.statV} style={col ? { color: col } : {}}>{v}</span>
                <span className={c.statL}>{l}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tri ── */}
        {!loading && stations.length > 0 && (
          <div className={c.toolbar}>
            <span className={c.tlbl}>Trier :</span>
            {['prix', 'ville'].map(k => (
              <button key={k}
                className={[c.sortBtn, sort === k ? c.sortOn : ''].filter(Boolean).join(' ')}
                onClick={() => setSort(k)}>
                {k === 'prix' ? `Prix ${fuelD ? 'Gazole' : 'E10'} \u2191` : 'Ville A\u2192Z'}
              </button>
            ))}
            {lastFetch && <span className={c.ts}>{fmtD(lastFetch.toISOString())}</span>}
          </div>
        )}

        {loading && (
          <div className={c.loading}><span className={c.spin} />Chargement des prix&hellip;</div>
        )}
        {!loading && error && (
          <div className={c.errBox}>
            <strong>Erreur</strong>
            <p style={{ marginTop: '.4rem' }}>{error}</p>
          </div>
        )}
        {!loading && !error && stations.length === 0 && (
          <div className={c.empty}>Aucune station trouv&eacute;e.</div>
        )}

        {!loading && sorted.length > 0 && (
          <div className={c.list}>
            {sorted.map((st, i) => {
              const p = getPrix(st)
			 
             return (
                <Card key={st.id || i} st={st} rank={i + 1}
                  isMin={p === minP && p != null}
                  isMax={p === maxP && p != null}
                  fuel={fuel}
                  onMapClick={setMapStation}
				  userPos={refPos}
                />
              )
            })}
          </div>
        )}

        <footer className={c.footer}>
          Source&nbsp;: Minist&egrave;re de l&apos;&Eacute;conomie &middot;
          Flux instantan&eacute; mis &agrave; jour toutes les 10&nbsp;min &middot;
          Licence Ouverte 2.0 (Etalab) &middot;
          Communes&nbsp;: geo.api.gouv.fr (Etalab)
        </footer>
      </div>

      {mapStation && (
        <MapModal station={mapStation} onClose={() => setMapStation(null)} />
      )}
    </main>
  )
}
