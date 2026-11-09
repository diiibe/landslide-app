# Rappresentazione multiscala dei dati

La politica in `src/regional/presentation.ts` risolve tutte le distribuzioni del
catalogo a partire da geometria, unità, provenienza e significato del campo.
La stessa politica alimenta schede, legende e renderer; le palette UI restano
separate dai colori delle misure.

- Registri puntuali: gruppi numerati esplorabili, singoli elementi al dettaglio,
  densità relativa facoltativa. I numeri contano record, incluso un record
  MultiPoint una sola volta; non indicano presenza di persone o attività correnti.
- Osservazioni ambientali: punti, colore e valore; niente interpolazioni tra
  stazioni. Censura analitica e qualità non valida restano distinte. Le piccole
  concentrazioni non vengono arrotondate a zero per la visualizzazione.
- Direzioni: frecce per unità angolari riconosciute, con azimut originale. Valori
  non validi/QC3–4 non generano frecce. Non sono particelle simulate.
- Idrometri: simboli uniformi, perché gli zeri delle stazioni sono locali.
  Codici di stato/diagnostica restano codici, senza scale ambientali inventate.
- Aree quantitative: colore del valore attribuito all'area, senza presumere
  uniformità interna o normalizzare conteggi grezzi per km². Le scale regionali
  con segni opposti sono centrate sullo zero; i modelli scientifici esistenti
  mantengono la propria classificazione.
- Piccoli perimetri: riferimenti di navigazione raggruppati, seguiti dalle
  geometrie precise avvicinandosi. Sono disponibili anche i soli perimetri.
- Edifici: conteggio delle impronte in panoramica, impronte e volumi dal livello
  di zoom 12; altezze soltanto dove attendibili secondo la fonte.
- Reti: tracciati con bordo di contrasto e spessore progressivo.
- Radar, ortofoto e rilievi: copertura georeferenziata originale, con la propria
  data e risoluzione; nessuna osservazione simulata.

## Panoramiche e aggiornamento

`regional_overviews.py` deriva piccoli indici di navigazione, con riferimenti interni ai piccoli perimetri e celle di circa
7 km per registri molto densi ed edifici alla latitudine regionale. Le celle
sono medie delle posizioni rappresentative, non posizioni esatte dei singoli
oggetti. I riferimenti delle piccole aree non ne rappresentano l’estensione e
restano disponibili fino allo zoom 14, quando i perimetri diventano leggibili. I cluster sommano `__count`, non il numero di
celle. Un tap avvicina progressivamente e rivela gli oggetti.

Per le future generazioni, `save_layer` prepara gli indici dalle geometrie
complete prima della conversione in tile. Il payload ha un nome basato sul suo
hash, quindi un fallimento non sovrascrive l'indice precedente conservato dal
catalogo. L'assembler mantiene i riferimenti ancora utilizzati. La generazione del catalogo cambia quando cambiano gli indici, mantenendo
invariate le date delle singole fonti. Il workflow
esistente rigenera e verifica le panoramiche ogni sei ore insieme ai dati.

Il backfill iniziale ricostruisce gli indici vettoriali soltanto quando gli ID
univoci al massimo zoom coprono esattamente il conteggio originale. Per gli
immobili storici (5034/5040) la panoramica è stata rifiutata: il layer originale
resta disponibile e la prossima importazione da geometrie complete può generare
l'indice. Non viene pubblicato un conteggio parziale come completo.

Le tile vettoriali dei registri densi non vengono richieste per il disegno delle
geometrie di dettaglio durante l'uso della panoramica. Il peso della densità degli
indici è relativo al massimo conteggio delle celle, con fonte, scala e significato
espliciti nella scheda. Non è una legenda quantitativa di inquinamento o rischio.

## Catalogo mobile

All'apertura: titolo focalizzato senza tastiera automatica, ricerca, filtri
chiusi, tutte le categorie in un menu verticale a due colonne. Una categoria,
una ricerca o un filtro conduce ai risultati; «Categorie» riporta all'inizio.
«Tutti i dati» apre la lista completa con caricamento progressivo. Le ricerche
nei menu HTML restano modificabili da tastiera e non aprono picker di Safari.

Le etichette numeriche dello sfondo OSM di riserva usano glifi ospitati
localmente; i simboli direzionali sono immagini RGBA proprie dell’app.
Gli stili del fornitore con token conservano i propri font della mappa.
