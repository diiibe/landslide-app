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

Le letture numeriche coincidenti dei livelli visibili sono righe della stessa
etichetta cartografica: valore e unità sotto il valore già visibile. Non ci sono
riquadri, conteggi, pulsanti di espansione o pannelli automatici. Le profondità,
quando presenti, distinguono le misure. Dimensione, alone, ancoraggio e gestione
delle collisioni restano quelli delle etichette originali MapLibre.

I dati originali non sono modificati: l'etichetta si aggiorna al refresh delle
fonti e al cambio dei livelli/opacità. Durante il disegno torna il testo ordinario;
al cambio stile viene ricostruita. Al di fuori dei punti condivisi, ciascuna fonte
mantiene le proprie etichette. Lo storico rimane nelle serie della fonte: non
vengono inventati campioni non caricati.

La scorciatoia radar è sostituita dalla radiazione solare. Il radar rimane
consultabile nel catalogo e mantiene il proprio aggiornamento automatico.

## Scelte rapide multiple

Ogni scelta rapida si accende e spegne indipendentemente, comprese le due
mappature delle frane. Il contatore indica quanti dei dieci livelli rapidi sono
attivi. I pulsanti precedono l'elenco dei livelli attivi, così aggiungere una
variabile non sposta le altre scelte. La legenda mostra entrambe le mappature
con le rispettive classi; le viste salvate conservano tutte le selezioni.
