# App Factory

Eine kopierbare Ausgangsbasis für kleine SaaS- und Web-Apps. Nach dem Kopieren muss
die neue App nur die konkrete Idee, Zielgruppe und den wichtigsten Nutzen festlegen.
Die KI-Arbeitsabläufe erzeugen daraus die projektspezifischen Dokumente und führen
schrittweise zur Implementierung.

## Start mit einer neuen Idee

1. Repository kopieren und neuen Projektnamen setzen.
2. Git-Status und vorhandene Umgebungsvariablen prüfen.
3. Die Idee einmal klar beschreiben: Nutzer, Problem, gewünschtes Ergebnis und der
   technisch schwierigste Kern.
4. In dieser Reihenfolge arbeiten:

   `@decision.md` → `@brainstorm.md` → `@planning.md` → `@setup.md` →
   `@design.md` → `@core.md` → optional `@monetization.md` und `@growth.md`

5. Nach jedem Schritt die erzeugte Datei unter `docs/` prüfen. Unklare Annahmen
   bleiben als offene Entscheidung markiert und werden nicht als Fakt behandelt.

Beispiel für den ersten Prompt:

> Idee: [ein Satz]. Zielgruppe: [konkrete Nutzer]. Das wichtigste Ergebnis ist
> [Nutzen]. Die technisch schwierigste Stelle ist [Kernproblem]. Starte mit
> `.ai/decision.md`.

## Dokumente

| Datei | Zweck | Quelle der Wahrheit |
| --- | --- | --- |
| `PRODUCT.md` | Produkt, Nutzer, Nutzen, Grenzen | Produktentscheidungen |
| `DESIGN.md` | UX-, Marken- und UI-System | Designentscheidungen |
| `docs/DECISION.md` | Stack- und Annahmenentscheidung | Architekturentscheidung |
| `docs/BRAINSTORM.md` | Optionen und Differenzierung | Ideationsphase |
| `docs/PRD.md` | MVP-Scope, Datenmodell, Tickets | Umsetzungsplan |
| `.ai/` | Wiederverwendbare Arbeitsanweisungen | Factory-Regeln |

`docs/` beschreibt das konkrete Projekt. `.ai/` bleibt beim Kopieren neutral und wird
nicht mit Produktnamen, Branchenregeln oder Beispieltexten angereichert.

## Technische Basis

Der aktuelle Starter enthält ein Next.js-Frontend und ein optionales .NET-Backend.
Die tatsächlich verwendeten Versionen stehen in `frontend/package.json` und
`Backend/Backend.csproj`; Anweisungen dürfen keine veralteten Versionsnummern
behaupten. Supabase, Stripe und weitere Dienste sind optional und werden nur nach
einer Entscheidung im PRD eingerichtet.

## Sicherheit beim Kopieren

Das Setup löscht weder `.git`, vorhandene Abhängigkeiten, `.env`-Dateien noch eigene
Quellcodeänderungen. Ein neues Repository und ein Commit sind bewusste Schritte des
Nutzers, keine automatische Nebenwirkung des Setup-Prompts.
