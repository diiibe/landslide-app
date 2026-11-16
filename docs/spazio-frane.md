# Spazio Frane · fascia alta e aree di lavoro

Le due mappe mantengono i punteggi originali del modello v2. I cinque gradi
visualizzati suddividono per quantili soltanto la precedente classe 5, cioè
circa il 20% superiore del dominio di ciascuna mappatura. Non sono probabilità
di frana, livelli di allerta o classi di rischio normativo. Le soglie regionali
sono fisse: non cambiano quando si disegna una zona o si modifica lo zoom.
I punteggi uguali restano nello stesso grado.

La classe più alta precedente comprende 61.947 celle per i corpi di frana e
61.936 per la franosità diffusa, su 309.674 celle per mappatura. Le quote
effettive dei nuovi gradi e i limiti numerici sono nel metadata model_v2.json;
le due mappe hanno soglie diverse e non devono essere sommate.

## Disegno

Tocca la mappa per posare vertici. **Indietro** rimuove l’ultimo vertice con
la cronologia nativa di TerraDraw; **Riparti da zero** svuota il contorno corrente,
senza toccare le aree già salvate. Con almeno tre vertici **Chiudi contorno**
porta al nome e al colore, poi **Salva e analizza** conserva l’area sul dispositivo.
**Annulla / Scarta** esce senza salvare il disegno corrente.

## Aree

Il pulsante Aree sotto Estensioni apre la raccolta nel pannello destro.
Il nome richiama la zona e apre la sua analisi; l’occhio mostra/nasconde il
contorno conservando il record. L’eliminazione richiede una conferma nella riga.
**Chiudi analisi e nascondi il contorno** rimuove il contorno temporaneo oppure
nasconde quello salvato: l’area salvata rimane richiamabile dalla raccolta.

Il contesto strade/sentieri segue la mappatura scelta nel selettore di analisi,
anche quando entrambe le superfici sono accese. Le soglie non sono adattate
alla zona. Il confronto richiama anche le aree salvate che erano nascoste.

## Denominatori e dati mancanti

La copertura è calcolata sul dominio completo, non dai tile visibili. Il
territorio mappato sotto la fascia alta rimane distinto dal territorio senza
mappatura. I cinque gradi più la superficie mappata sotto soglia ricompongono
la superficie coperta. I grafici dei gradi nell’ispettore mostrano le quote
della fascia alta; le percentuali esportate dichiarano esplicitamente il
denominatore. Media, mediana e percentili del punteggio si riferiscono a tutta
la superficie mappata, pesata per l’intersezione con la zona.

## Esportazione

- **GeoJSON:** perimetro WGS84, attributi piatti con unità, risultati completi,
  fonte, versione e soglie. Si apre in QGIS e si reimporta con Strumenti →
  Esporta/importa → Importa archivio FVG. Alla riapertura l’analisi viene
  ricalcolata, evitando di presentare risultati storici come nuovi.
- **CSV:** tabelle delle due mappature con unità esplicite, dati mancanti,
  territorio sotto fascia alta e metadati. Apribile in Excel/LibreOffice.
- **Relazione HTML:** documento autonomo offline con tabelle, fonte, metodo e
  limiti; stampabile in PDF dal browser. Non dipende da mappe o font remoti.
- **JSON:** geometria e risultato completo per elaborazioni successive.

Aprire Contesto e attendere il calcolo per includere reti e punti nell’export.
Il confronto tra due zone offre gli stessi formati dopo il completamento di
entrambe le analisi. Le due geometrie e le rispettive versioni restano separate.
La selezione effettiva sulla mappa è registrata separatamente dal grado minimo
scelto nel confronto.

Le vecchie viste salvate con la classificazione precedente vengono migrate
mostrando tutti i cinque nuovi gradi, mantenendo l’opacità. Le nuove viste
memorizzano lo schema upper-quintile-v1 e le selezioni non contigue.
