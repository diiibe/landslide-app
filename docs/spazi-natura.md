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

- Otto camere inventate. Catture determinate da camera e ora assoluta: stesse
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
