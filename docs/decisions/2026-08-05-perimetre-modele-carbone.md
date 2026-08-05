# Périmètre du modèle carbone : usage seulement, et rien d'inventé

**Contexte** : le modèle exposait trois sources d'émission — `networkCo2`, `cpuCo2`, `renderingCo2`. Les deux dernières multipliaient **la même** valeur (`PerformanceNavigationTiming.duration`) par deux coefficients différents, `0.001` et `0.0004`. Ce n'était pas deux mesures : c'était une mesure avec un facteur découpé en deux, et le découpage suggérait une précision qui n'existait pas. L'export CSV propageait la fausse ventilation en trois colonnes.

Le champ portant cette valeur s'appelait `cpuTimeToLoad`. Il ne mesure pas de CPU : `duration` est du temps mural entre le début de la navigation et la fin du chargement.

Enfin, le périmètre n'était écrit nulle part. Un lecteur ne pouvait pas savoir si le chiffre incluait la fabrication des équipements, ni pourquoi une page servie par le cache coûtait zéro.

**Décision** : **usage seulement**. Le modèle compte l'énergie consommée pendant la navigation — réseau, datacenter, appareil — et exclut la fabrication des serveurs, des équipements réseau et de l'appareil de l'utilisateur. Le chiffre produit est donc un **plancher**, pas un total : environ 20 à 25 % sous un modèle à périmètre complet comme Sustainable Web Design. C'est écrit dans le glossaire et dans `carbon-model.md`, pas seulement supposé.

Trois conséquences directes sur les sources :

1. `cpuCo2` et `renderingCo2` fusionnent en `deviceCo2`, facteur `0.0014`. Une valeur, une source, un nom.
2. `cpuTimeToLoad` devient `pageLoadDurationSec`, et sa définition dit explicitement qu'il s'agit d'un **proxy de temps mural**, pas d'une mesure de CPU.
3. Une source `screenCo2` est ajoutée, alimentée par le temps d'écran cumulé de la visite. C'est ce qui fait qu'une heure de vidéo coûte plus qu'ouvrir un article. Elle n'a été rendue possible que par l'enregistrement vivant décidé dans l'ADR sur la visite de page — l'input n'existait pas avant.

**Sur le cache** : une ressource servie depuis le cache a `transferSize = 0`, donc zéro CO₂ réseau. L'intuition qu'elle n'est pas gratuite est correcte, mais son coût résiduel est du **temps** — décodage, lecture disque — donc déjà capté par `deviceCo2` via la durée de chargement. Ajouter un facteur au byte double-compterait la même énergie, et aucune source publiée ne donne de gCO₂e par octet lu depuis un disque : il faudrait l'inventer.

Le cache ne reçoit donc aucun facteur. À la place, un concept **CO₂ évité** est exposé : `decodedBodySize` des ressources servies par le cache × `CARBON_PER_GB`. Chiffre positif, calculé depuis une donnée déjà présente dans `PerformanceResourceTiming`, jamais soustrait du total.

**Conséquences** :

- `ContributionMetric` passe de `"networkCo2" | "cpuCo2" | "renderingCo2"` à `"networkCo2" | "deviceCo2" | "screenCo2"`. Les colonnes CSV changent, l'en-tête d'export doit être versionné ou l'ancien format documenté comme abandonné.
- Les données déjà stockées portent l'ancienne forme de `CarbonEstimate`. Une migration ou une lecture tolérante est nécessaire — un `renderingCo2` absent ne doit pas produire de `NaN` dans les totaux.
- Le périmètre usage-seulement contamine la comparaison à la moyenne mondiale, dont la référence est à périmètre large. Traité dans l'ADR sur les niveaux de sobriété.
- **Règle qui découle de cette décision** : tout facteur d'émission porte soit une source publiée, soit la mention explicite « estimation maison ». Une constante non sourcée présentée comme sourcée est le seul défaut qui discrédite l'application entière.
