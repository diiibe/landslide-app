# Aria e industria · Pordenonese

Spazio nativo FriulView, accessibile da Spazi oppure con `?space=air`. La mappa è la stessa istanza MapLibre dell’app, inclusi sfondi Mapbox, camera, controlli e impostazioni. Non incorpora la demo in un iframe.

Le tre domande attivano i rispettivi gruppi e aprono i controlli in basso a sinistra. Una seconda pressione rilascia solo i livelli acquisiti dal gruppo: livelli già accesi manualmente o condivisi con un’altra domanda restano disponibili. Spegnendo tutti i livelli del gruppo si spegne anche la domanda. Chiudere il pannello non spegne i dati.

I sette livelli principali mantengono visibilità e opacità indipendenti. Aprire una descrizione non accende implicitamente il livello. Le destinazioni industriali/artigianali e commerciali restano due voci alla pari della copertura del suolo. CORINE è un confronto storico facoltativo, esclusivo rispetto a WorldCover. Nessuna simulazione del vento è inclusa.

## Fonti e aggiornamento

- **ARPA / SoDA**: PM10 e PM2.5 sono medie giornaliere, NO₂ è il massimo orario nella giornata. L’app interroga direttamente i tre endpoint ogni cinque minuti durante la consultazione visibile, al ritorno in primo piano e al ripristino della connessione. Il polling non aumenta la frequenza di misura/pubblicazione della fonte. L’API non espone il livello ufficiale di validazione. Il flag dati insufficienti produce un valore nullo, conservando il grezzo.
- **SME Fanna Cementi**, portale indicato da ARPA: tre serie giornaliere NOx, polveri e SO₂ in mg/Nm³; verifica oraria dei due mesi più recenti dal workflow. Qualificatori come `5s` e giornate vuote non diventano zero. Il punto mappa è la localizzazione amministrativa AIA dell’attività, non una coordinata certificata della bocca del camino.
- **INEMAR 2023**, pubblicazione ARPA in Revisione pubblica: inventario comunale annuale, t/anno. Verifica oraria della pubblicazione e conservazione di URL/versione/SHA256. Le geometrie comunali non implicano una diffusione uniforme; l’altezza 3D è simbolica. Le celle ignote restano distinte dagli zeri.
- **Regione FVG WFS**: registro AIA, zone industriali/artigianali e commerciali; verifica oraria. Le date di validità dei piani sono quelle dei singoli record. AIA è un registro amministrativo: la heatmap usa pesi uguali per registrazione, non misura emissioni o pericolosità.
- **ESA WorldCover 2021**: prodotto storico classificato. PNG locali con ricampionamento nearest e undici classi. Il click interroga la massima risoluzione locale, indipendentemente dallo zoom visuale; non è un rilievo attuale. Provenienza, trasformazioni e licenze in `public/data/spaces/air/NOTICE.txt`.

Il workflow `refresh-air-space.yml` gira ogni ora, preserva l’ultima copia valida per ciascuna fonte fallita, pubblica lo stato dell’errore e attiva il deploy Pages. Le osservazioni ARPA vengono anche aggiornate direttamente dal browser. Le date di controllo e misura sono distinte e visibili. I valori non vengono simulati per riempire i giorni mancanti.

## Esplorazione ed esportazione

Le centraline restano ancorate geograficamente e mostrano tutti e tre i valori affiancati al punto. Il colore segue il parametro scelto e una scala fissa sull’intera serie disponibile, senza riscalare ogni giorno. Il confronto conserva le due serie complete e calcola lo scarto solo sulle date valide comuni. Le tre serie SME hanno scale indipendenti.

Le sei estensioni conservano il significato della demo: sorgenti comunali, confronto centraline, tre misure Fanna, registro AIA, lettura del territorio e dossier. I controlli temporali compaiono solo con livelli temporali visibili e indicano esplicitamente la serie comandata.

Il dossier JSON include serie A e B separate, valori grezzi/nulli, coppie confrontabili, SME, configurazione dei livelli, geometrie, provenienza e disponibilità. Il CSV esporta le due serie ambientali con unità e stato; il GeoJSON conserva il Comune e il riepilogo dell’inventario. I testi formula vengono neutralizzati nel CSV. Le viste salvate conservano preferenze e camera, mai una copia congelata delle osservazioni.

Il contesto vicino a una centralina non è un’area di rappresentatività certificata. Inventario, misure ambientali, misure al camino e autorizzazioni hanno scale e unità diverse: lo spazio facilita il confronto, senza attribuire causalità, esposizione o superamenti normativi automatici.
