# Personalizzazione dell’interfaccia

Impostazioni → Aspetto dell’app conserva tema, palette e animazioni nella sezione
Generali. Le sezioni successive personalizzano separatamente Navbar, pulsante
Catalogo, pulsante Spazi, Ricerca, Pannello laterale, Catalogo dei dati, Comandi
mappa e Schede sensore.

Ogni componente offre fondo/testo/bordo, opacità del fondo, sfumatura di luce,
profondità, angoli, texture (nessuna, profilo regionale o reticolo), intensità,
font, dimensione e peso. Le scritte modificabili sono quelle dell’interfaccia:
nomi delle misure, unità, date e attribuzioni delle fonti restano scientificamente
identificabili. Sui dispositivi touch gli input mantengono almeno 16 px.

La modifica è immediata, con anteprima e ripristino del singolo componente.
Progetto UI nella sezione Generali esporta/importa JSON versione 1. Le preferenze
restano nel browser e non sincronizzano account o dispositivi. Un errore di
localStorage mantiene attiva la modifica e invita a conservare il JSON. Il
ripristino globale rimuove componenti e scritte, conservando tema e palette.
L’editor stesso mantiene i token di base, per restare utilizzabile anche se il
componente modificato ha una combinazione poco leggibile.

I confini `data-ui` isolano colori, font e dimensioni ereditate. Il file di
configurazione usa una lista ammessa di colori esadecimali, intervalli numerici,
font e texture: non esegue HTML, CSS o JavaScript importato. Le scale della mappa
e i valori osservati non sono modificati.

## Più dati nello stesso punto

Gli stack sulla mappa raggruppano i record geografici coincidenti dei livelli
visibili, deduplicando i soli duplicati di rendering (punto/alone/etichetta).
Variabili, profondità e identità diverse rimangono righe distinte, con valore,
unità e metadati. A scala locale l’elenco si apre automaticamente; da lontano il
conteggio si espande sul posto. Ogni riga apre il proprio dettaglio. Gli elenchi
lunghi scorrono senza troncare il numero di record.

Lo stack si aggiorna al refresh delle fonti, alla visibilità/opacità dei livelli
e alla camera. Rispetta lo spazio libero dal drawer, viene rimosso durante il
disegno e ricostruito dopo il cambio stile. I cluster geografici e le panoramiche
restano riferimenti di navigazione, non valori interpolati. L’eventuale storico
rimane nelle serie della fonte: lo stack non inventa campioni non caricati.

La scorciatoia radar è sostituita dalla radiazione solare. Il radar rimane
consultabile nel catalogo e mantiene il proprio aggiornamento automatico.
