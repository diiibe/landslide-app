# Spazi Natura

Tre esperienze condividono navigazione, camera, selezione, catalogo ed Estensioni
con gli Spazi esistenti. Gli archivi e le esercitazioni non transitano nel motore
numerico delle cinque precedenti demo.

## Amariana · dopo il fuoco

- Quattro schede EFFIS selezionate nel riquadro Tolmezzo–Amaro con FIREDATE
  nell'agosto 2026. Non tutti i poligoni sono attribuiti a un singolo incendio.
- Fonte: European Commission / Copernicus EMS / JRC–EFFIS, CC BY 4.0.
  `scripts/build-nature-archives.py` converte GML in GeoJSON e conserva attributi
  e coordinate. Rifiuta dati vuoti/troncati, identità duplicate, coordinate
  invertite e geometrie invalide. Il workflow regionale lo esegue ogni sei ore.
  Su errore conserva il payload e retrievedAt precedenti, rende visibile
  refreshError e registra separatamente lastCheckedAt.
- I perimetri sono finali; FIREDATE/FINALDATE non sono innesco e spegnimento
  ufficiali. Nessuna animazione inventa la propagazione o interpola fumo.
- Diciannove fatti numerici da tabelle ARPA del 14–19 agosto, in tre località.
  Range e campioni ripetuti sono conservati. Coordinate solo indicative delle
  località, non GPS dei campionamenti. Sono misure istantanee speditive, non medie
  giornaliere o indicatori di superamento normativo.
- La timeline avanza solo fra giornate documentate. Le ordinanze sono storiche,
  non informazioni sull'accessibilità odierna dei sentieri.

## Tracce nel bosco

- Otto camere virtuali riposizionate rispetto al Sentiero Fassoz e alle piste OSM adiacenti. La geometria di riferimento è un estratto statico API OSM del 10 novembre 2026, ODbL, con identificativi way e tag conservati in `camera-tracks.geojson`. Esclusi ponti, accessi privati dichiarati e difficoltà alpine dichiarate. Nessuna verifica sul terreno o autorizzazione è implicita.
- Bersaglio sul tracciato a circa 5 m, quota camera ipotizzata 50 cm, settore ottico 40°/12 m della sola postazione scelta. Non è una misura di copertura o rilevabilità. Distanza minima fra postazioni 250 m circa; rete mirata ai passaggi, non protocollo di densità casuale.
- Catture determinate da camera e ora assoluta: stesse
  identità e valori dopo riapertura o scorrimento della finestra.
- Notte/giorno in Europa/Roma, indisponibilità simulate, sforzo integrato sulle
  effettive porzioni di ore; finestre di 6, 24 o 72 ore aggiornate ogni minuto.
- Immagini generate (atlante 3×2), riutilizzate come esempi della specie; riquadri,
  proposte e score sono simulati. Nessun vision model è eseguito o calibrato.
- Conferma/correzione umana conservata separatamente dal record generato nella
  memoria della sessione; esportazione JSON. Nessun upload o training.
- Catture e tassi per 100 giorni-camera non stimano individui o abbondanza reale.

## Villa Manin · patrimonio vivo

- Riuso integrale delle 456 posizioni geolocalizzate del layer regionale
  `open-uqpq-dr8x` (ERPAC / IODL). La fonte ha 1.242 righe, con frammenti e
  record privi di coordinate; le righe non sono tutte alberi distinti.
- Rilievi 2001–2002, provider aggiornato nel 2019, cadenza non dichiarata.
  La data di acquisizione non viene presentata come data di un nuovo rilievo.
- Ricerca, famiglie, campi originali e condizioni storiche; nessuna diagnosi
  attuale. PIHF è forma della chioma, non punteggio di salute.
- Giro e annotazioni demo separati dalla fonte; ordine per prossimità geometrica
  senza dedurre percorribilità. Minuti di sola attività ipotizzati, senza ETA.
  Distanza in linea d'aria esplicita. Esportazione con provenienza e modalità.

## Comportamento comune

I nodi Natura partecipano al selettore di tutte le letture coincidenti,
con deduplica di punto/alone/etichetta. I cluster aprono tutti i record
coincidenti o avanzano al dettaglio; richieste della vecchia sorgente non
muovono la camera dopo un cambio stile. Le fonti e le simulazioni si fermano
quando la pagina non è visibile e tornano all'istante pertinente alla riapertura.
La timeline storica conserva il proprio giorno; i valori degli altri Spazi non
sono congelati. I pannelli usano Manrope, selettori interni, target touch 44px,
focus sulla scheda selezionata e movimento ridotto.

## Estensioni operative · 0.5.1

Ogni pannello apre un compito distinto con controlli e risultato nello stesso
contesto. La selezione di una scheda o di record coincidenti conserva il compito.

- Amariana: confronto di due campioni della stessa località, conservando gli
  intervalli. Differenza [B.min-A.max, B.max-A.min], zero per lo stesso campione;
  nessun valore medio inventato o limite normativo. Azione mappa = località e
  giorno finale, con tutti i campioni di quel giorno. Confronto JSON esportabile.
  Schede finali EFFIS consultabili separatamente, senza trasformare quattro
  eventi vicini in fasi dello stesso incendio. Non è stata verificata una serie
  storica di geometrie successive per questi eventi. La guida EFFIS documenta
  l'evoluzione «quando disponibile», non una disponibilità garantita per Amariana.
- Fauna: revisione con conferma/correzione ed avanzamento alla cattura successiva,
  distinta dal controllo della rete. Checklist di batterie/memoria, ottica/fissaggio,
  orologio/scatto, con nota e timestamp; esercitazione locale esportabile, nessuna
  modifica della disponibilità sintetica. Il settore metrico e i tracciati non
  diventano territori di animali o stime di abbondanza. Fotografie illustrative
  riusate, senza riquadri fittizi di rilevamento; notte resa monocromatica.
- Villa Manin: aggiunta dei risultati filtrati al giro (primi 20, dichiarati),
  scheda/annotazione aperta direttamente nel compito, ordine per prossimità e CSV
  della lista di lavoro con coordinate, etichetta, rilievo storico e note separate.
  Campi testuali CSV quotati, prefissi formula neutralizzati. Nessun ETA pedonale
  o diagnosi fitostatica attuale. Lo stato di lavoro resta nella sessione e può
  essere esportato prima di chiuderla.
