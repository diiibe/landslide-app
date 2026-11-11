# SmartTrek nelle Dolomiti Friulane

Spazio dimostrativo indipendente: `?space=trek`. Non è un’installazione del Parco, un servizio di soccorso o una dimostrazione di copertura radio.

## Fonte firmware verificata

Repository: https://github.com/cariddi-stefano/firmware-smart-trek
Revisione studiata: `3f9ddfd06ab6aba12bb8028a6b15f8f1f243fbff`.
Licenza della repository: Apache-2.0. Nessun codice del firmware è incorporato o eseguito dall’app.

Letti README, OWNER_DECISIONS_2026-11-03, ADR-0011/0013, V0_2_MIGRATION_PLAN, RELEASE_READINESS, header C++ e la specifica PDF «Smart Trail Marker — Specifiche Firmware v0.2», in particolare §§5–8 (telemetria, BLE e gateway).

La v0.2 è la specifica corrente. Il codice e i contratti Markdown precedenti non sono automaticamente conformi; la repository dichiara firmware non operativo sul campo, un solo dispositivo di prototipo e Master/cloud/app ancora da realizzare. Non esiste un endpoint pubblico operativo da collegare. La demo non sostiene che la migrazione sia completata.

## Misure rappresentate

| Dato | Fonte v0.2 | Rappresentazione |
| --- | --- | --- |
| Linea ESP32 e linea E220 | Due INA219; mV e decimi di mA nel pacchetto, mA nel JSON | Due letture separate, grafico della potenza totale e soglia **demo** 3,15–3,45 V |
| BLE e check-in | `ble_adv_count`, `app_checkins`, `peak_rssi` | Conteggi per nodo/intervallo, confronto e CSV. Non sono persone uniche. Picchi ammessi ≥−75 dBm |
| Link e tempo | RSSI LoRa, `time_synced`, `hops` dell’esempio JSON | Scheda di ricezione e stato, nessuna stima di portata o affidabilità |
| Consegna | Esempio MQTT v0.2, più intento owner di conferma DB ancora da riconciliare | Tre tempi distinti: campione, ricezione Master, conferma DB **simulata** |

Non si aggiungono sensori meteo, percentuale batteria, autonomia o posizioni di persone: non sono misure disponibili della baseline. Il picco RSSI è `null` quando non ci sono advertiser, una convenzione della demo, non una codifica binaria prescritta dal firmware. Il JSON esportato dichiara `demo:true`, la revisione studiata e le estensioni temporali. Non è un client MQTT né un validatore del protocollo binario. `hops` conta le tratte della topologia demo; non viene equiparato al byte `hop_count` del PDF.

## Geografia e posa

`src/spaces/trek/network.json` conserva l’estratto derivato da OSM: provenienza, data, bbox richiesto, sei way ID e 296 coordinate del cammino nel grafo tra punti prossimi al Rifugio Pordenone e alla Casera Valbinon. Lunghezza geometrica arrotondata 5.748 m, non distanza escursionistica certificata. Gli otto punti virtuali coincidono esattamente con vertici OSM, distanziati circa 800 m lungo il percorso: un Master e sette segnavia. La topologia ipotetica raggiunge il Master in massimo tre tratte; tratteggi disattivati di default, mai circoli di copertura.

Contesto verificato: [Parco · Sentiero geologico Montanaia Meluzzo](https://www.parcodolomitifriulane.it/sentiero-geologico/sentiero-geologico-montanaia-meluzzo/), [CAI FVG · sentiero 361](https://www.cai-fvg.it/sentieri-cai-fvg/settore-3-dolomiti-friulane-alpi-prealpi-carniche/s3-361/). La linea geometrica è OSM e non viene presentata come intero sentiero CAI verificato. © OpenStreetMap contributors, ODbL, attribuzione anche in mappa. Nessun confine del Parco viene inventato.

## Tempo e strumenti

Campioni assoluti deterministici con fase per nodo e jitter limitato: distanza tra campioni 9–11 minuti. La vista si aggiorna dall’orologio ogni secondo mentre è visibile, sospende il timer in background e ricostruisce l’istante al ritorno. Non rigenera eventi passati casualmente; finestre sovrapposte condividono gli stessi campioni. Il replay resta fisso anche dopo cambio tab. Profilo diurno/stagionale sintetico con fuso Europe/Rome e DST; non è un modello calibrato di affluenza o consumo.

- **Passaggi BLE:** confronta i conteggi già ricevuti in 6/24 ore; esporta una riga per nodo, senza totale di persone.
- **Alimentazione:** confronta le due linee, legge lo storico campione per campione, esporta JSON; esercizio di tensione bassa al nodo 106.
- **Trasmissione e buffer:** esercizio di interruzione Master–cloud di 40 minuti, iniziato esplicitamente 20 minuti prima dell’istante consultato. Radio e cloud restano distinti; il buffer previsto è conosciuto dal simulatore, non osservato da un gateway offline. Dopo il recupero i campioni vengono confermati. Bilancio della finestra: creati = confermati + in attesa. Nessun comando viene inviato a hardware o infrastrutture.

Per una futura integrazione reale servono contratti v0.2 stabilizzati, ricezione dal Master, endpoint backend e autenticazione, verifica hardware/RF e mapping dei timestamp. GitHub Pages non viene usato come broker o deposito di credenziali.
