# Weather Underground

Deine private Wetterstation, wie sie auf Weather Underground veröffentlicht ist, in Gladys: Temperatur,
Luftfeuchtigkeit, Wind, Regen, Luftdruck, UV und Sonne, alle 5 Minuten über die offizielle API
abgefragt, die The Weather Company den Stationsbesitzern gibt. Du kannst auch jede andere öffentliche
Station verfolgen, zum Beispiel die deines Nachbarn.

Diese Integration ist weder mit Weather Underground, The Weather Company oder IBM verbunden noch von
ihnen unterstützt. Entwickelt wurde sie ohne die Hardware und ohne API-Schlüssel: Rückmeldungen sind
willkommen.

## Überblick

- **Ein Gerät pro Station**, mit ihren Sensoren als Funktionen: Temperatur, gefühlte Temperatur,
  Taupunkt, Luftfeuchtigkeit, Luftdruck, Windgeschwindigkeit, Windböen und Windrichtung,
  Regenintensität und Regen heute, UV-Index, Helligkeit (aus der Sonnenstrahlung) und Alter der letzten
  Messung.
- **Ein Dashboard-Widget**, das die letzte Messung einer Station und ihr Alter zeigt.
- **Eine stumme Station wird gemeldet**: Die Werte der Station werden nicht mehr aktualisiert, das Alter ihrer
  Messung wächst weiter, und ihr Symbol in der Geräteliste wird orange.
- Nur lesend: Nichts wird gesteuert, nichts wird an Weather Underground gesendet.

Jede Station funktioniert, egal welcher Marke (Ecowitt, Davis, Ambient Weather, Netatmo über eine
Brücke, WeeWX…), solange sie ihre Daten an Weather Underground sendet.

## Voraussetzungen

- Gladys 5.1 oder neuer.
- Ein **API-Schlüssel von Weather Underground**. Er ist kostenlos, aber nur für Mitglieder, deren
  private Wetterstation Daten an Weather Underground sendet: Melde dich auf wunderground.com an, öffne
  **Member settings**, dann **API Keys**, und erzeuge einen Schlüssel (32 Zeichen).
- Die **ID** jeder Station, die du verfolgen willst: Die ID steht auf der Seite der Station (zum Beispiel
  `IBERLIN123` oder `KCASANFR1234`). Es ist die ID, nicht der Name der Station.
- Gladys braucht Zugang zum Internet (`api.weather.com`).

## Konfiguration

1. Installiere Weather Underground unter **Integrationen** und öffne den Tab **Konfiguration**.
2. Füge den **API-Schlüssel** ein.
3. Gib die **Stations-IDs** ein, durch Kommas getrennt (höchstens 10).
4. Wähle das **Aktualisierungsintervall** (standardmäßig 5 Minuten) und die **Sprache der
   Funktionsnamen**.
5. Speichere und klicke auf **Verbindung testen**: Jede Station antwortet mit ihrer Temperatur und dem
   Alter ihrer Messung.
6. Öffne den Tab **Erkennung** und füge die Stationen hinzu.

Die Funktionsnamen werden beim Hinzufügen einer Station festgelegt: Ändere die Sprache, bevor du sie
hinzufügst.

## Die Stationsgeräte

Jede Station ist ein Gerät, benannt nach ihrem Viertel und ihrer ID („Mitte (IBERLIN123)“), mit diesen
Funktionen in metrischen Einheiten:

| Funktion                      | Einheit | Hinweis                                                             |
| ----------------------------- | ------- | ------------------------------------------------------------------- |
| Temperatur                    | °C      |                                                                     |
| Gefühlte Temperatur           | °C      | Windchill bei Kälte und Wind, Hitzeindex bei Hitze und Feuchtigkeit |
| Taupunkt                      | °C      |                                                                     |
| Luftfeuchtigkeit              | %       |                                                                     |
| Luftdruck                     | hPa     | auf Meereshöhe umgerechnet                                          |
| Windgeschwindigkeit, Windböen | km/h    | nur bei einer Station mit Windmesser                                |
| Windrichtung                  | °       | 0 = Nord, 90 = Ost                                                  |
| Regenintensität               | mm/h    | nur bei einer Station mit Regenmesser                               |
| Regen heute                   | mm/d    | seit Mitternacht, Ortszeit                                          |
| UV-Index                      |         | nur bei einer Station mit UV-Sensor                                 |
| Helligkeit (Sonnenstrahlung)  | lux     | W/m² × 126,7, siehe Einschränkungen                                 |
| Alter der Messung             | min     | Minuten seit der letzten Messung der Station                        |

Eine Funktion, für die die Station keinen Sensor hat, wird nicht angelegt. Nur geänderte Werte werden an
Gladys gesendet, und jeder Wert wird mindestens alle 6 Stunden erneut gesendet, damit er nie veraltet
wirkt.

Wenn eine Station keine Daten mehr sendet (Stromausfall, WLAN gestört), behält Weather Underground ihre
letzte Messung eine Stunde lang. Nach **30 Minuten** ohne neue Messung aktualisiert die Integration die
Werte nicht mehr (eine alte Temperatur würde aktuell wirken), aktualisiert weiter das **Alter der
Messung** und markiert die Station mit einem orangen Punkt in der Geräteliste. Mit der nächsten Messung
ist alles wieder da.

## Dashboard-Widget

Füge das Widget **Wetterstation** einem Dashboard hinzu und wähle eine Station (leer: die erste). Es
zeigt:

- Temperatur, Feuchtigkeit, Wind, Regen heute und Luftdruck, live;
- die Temperaturkurve der letzten 24 Stunden (sobald die Station in Gladys hinzugefügt ist);
- die Uhrzeit der Messung und ihr Alter (orange, wenn die Station stumm ist), die gefühlte Temperatur,
  den Taupunkt, die Böen, die Windrichtung, die Regenintensität, den UV-Index und die Sonnenstrahlung in
  W/m².

Das Widget ruft nie die API auf: Es zeigt die zuletzt gelesene Messung.

## Szenen-Auslöser und -Aktionen

Die Integration bringt keine eigenen Szenen-Auslöser oder -Aktionen mit: Jeder Wert ist eine Funktion
des Stationsgeräts, die die Standard-Szenenkarten schon verarbeiten (**Zustandsänderung eines Geräts**,
mit Schwellenwert, und **Gerätewert abrufen**). Ein Auslöser „es beginnt zu regnen“ würde nur
„Regenintensität über 0“ wiederholen.

## Szenenbeispiele

- **Regenalarm**: Wenn die _Regenintensität_ deiner Station über 0 mm/h steigt, sende „Es regnet, hol
  die Wäsche rein“ und schließe das Dachfenster.
- **Frostwarnung**: Wenn die _Temperatur_ abends unter 1 °C fällt, sende eine Nachricht, um die Pflanzen
  abzudecken.
- **Gießen sparen**: Lies vor der Gartenbewässerung den _Regen heute_ und brich ab, wenn er über 5 mm
  liegt.
- **Station ausgefallen**: Wenn das _Alter der Messung_ über 60 Minuten steigt, sende eine Nachricht,
  um Strom und WLAN der Station zu prüfen.
- **Markise**: Wenn die _Windböen_ über 40 km/h steigen, fahre die Markise ein.

## API-Kontingent und Aktualisierung

Ein Weather-Underground-Schlüssel erlaubt **1.500 Aufrufe pro Tag und 30 pro Minute**, für alle
Programme, die ihn nutzen. Jede Station kostet einen Aufruf pro Aktualisierung: 288 Aufrufe pro Tag bei
5 Minuten. Ab 5 Stationen verlangsamt die Integration die Aktualisierung selbst (5 Stationen: alle 6
Minuten; 10 Stationen: alle 11 Minuten) und hält etwa 10 % des Kontingents für Neustarts und Tests
frei. Wenn du denselben Schlüssel woanders nutzt (anderes Smart-Home-System, Skript), wähle ein
längeres Intervall.

Wird das Kontingent trotzdem überschritten, pausieren die Abfragen 15 Minuten. Ein abgelehnter
Schlüssel wird stündlich erneut versucht, oder sobald die Konfiguration gespeichert wird.

Die Messungen kommen alle paar Minuten von den Stationen selbst: Schneller als alle 5 Minuten zu
aktualisieren brächte nichts Neues.

## Fehlerbehebung

- **„Weather Underground lehnt den API-Schlüssel ab“**: Kopiere den Schlüssel erneut aus **Member
  settings → API Keys**. Weather Underground kann den Schlüssel einer Station deaktivieren, die seit
  langem nichts mehr sendet.
- **„Keine Messung in der letzten Stunde (Station offline oder unbekannte ID)“**: Die API unterscheidet
  eine Station, die offline ist, nicht von einer falschen ID. Prüfe die ID auf der Seite der Station
  (Buchstaben und Ziffern, wie `IBERLIN123`) und ob die Station auf wunderground.com aktuelle Daten
  zeigt.
- **„ID von der API abgelehnt“**: Die ID enthält etwas, das die API ablehnt: Gib sie neu ein.
- **„API-Kontingent überschritten“**: siehe „API-Kontingent und Aktualisierung“; die Abfragen gehen nach
  15 Minuten weiter.
- **„Die Weather Underground API antwortet nicht“**: Gladys erreicht `api.weather.com` nicht: Prüfe die
  Internetverbindung und das DNS.
- **Eine Funktion fehlt**: Die Station hat für diesen Sensor keinen Wert gesendet, als sie hinzugefügt
  wurde. Kam der Sensor später dazu, starte eine Suche im Tab **Erkennung** und aktualisiere das Gerät.
- Details: Setze `LOG_LEVEL=debug` am Container, um jede Abfrage in den Protokollen der Integration zu
  sehen. Der API-Schlüssel steht dort nie.

## Einschränkungen

- Nur metrische Einheiten (°C, km/h, hPa, mm).
- Die **Helligkeit** wird aus der Sonnenstrahlung berechnet (W/m² × 126,7, der Faktor, mit dem
  Ecowitt-Stationen ihren Lux-Wert als W/m² senden): exakt für diese Stationen, eine Näherung des
  Tageslichts bei einem Pyranometer (Davis). Das Widget zeigt auch den Wert in W/m².
- Keine Vorhersage: Die Wetterdienste von Gladys (OpenWeather, Météo-France…) liefern sie schon; diese
  Integration bringt, was sie nicht können: die Messungen einer Station ganz in der Nähe.
- Höchstens 10 Stationen pro Schlüssel.
- Die Daten und ihre Verfügbarkeit hängen von The Weather Company ab, die diese kostenlose API jederzeit
  ändern oder einstellen kann.
- Ohne die Hardware und ohne API-Schlüssel entwickelt: Die Antworten der API stammen aus ihrer
  Dokumentation, noch nicht von einer echten Station. Rückmeldungen sind im GitHub-Repository
  willkommen.
