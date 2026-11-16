# Credits and licences

## Recordings

Every animal voice that is not synthesised is a field recording shared on [xeno-canto](https://xeno-canto.org/) by the person who made it.
All 25 are under Creative Commons licences that allow adaptation; none is a NoDerivatives licence. The clips in `public/audio` are
adaptations: each is one stretch of the original, cut where the call is clearest, with low rumble filtered out, tape hiss gently reduced
and the level set. Nothing is pitch-shifted, sped up or mixed with anything else. The clips are shared under the same licence as their source.
The list the build reads is [`audio/sources.json`](audio/sources.json); the script is [`scripts/build-audio.mjs`](scripts/build-audio.mjs).

| Species | Recording | Recordist | Where | Licence | Part used | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Nyctibius griseus | [XC257763](https://xeno-canto.org/257763) | John V. Moore | Sucumbíos: 'Sacha Lodge', n bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 26.9 s to 36.5 s |  |
| Alouatta seniculus | [XC988610](https://xeno-canto.org/988610) | GABRIEL LEITE | Carauari, Amazonas, Brazil | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 1.6 s to 15.2 s | From Carauari, Brazil. Filed on xeno-canto as Alouatta seniculus; some authors now treat howlers of that region as a separate species. |
| Megascops watsonii | [XC257743](https://xeno-canto.org/257743) | John V. Moore | Sucumbíos: 'La Selva Jungle Lodge', n bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 2.1 s to 12.8 s |  |
| Lophostrix cristata | [XC257745](https://xeno-canto.org/257745) | John V. Moore | Sucumbíos: 'La Selva Jungle Lodge', n bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 12.7 s to 19.4 s |  |
| Pulsatrix perspicillata | [XC120560](https://xeno-canto.org/120560) | Lars Lachmann | Sani lodge, Napo, Ecuador | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) | 25.6 s to 33.1 s |  |
| Nyctibius grandis | [XC260436](https://xeno-canto.org/260436) | Mitch Lysinger | Sucumbíos: 'Sacha Lodge', n bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 0.8 s to 7.8 s |  |
| Tinamus major | [XC257240](https://xeno-canto.org/257240) | John V. Moore | Pastaza: Kapawi area, left bank Río Pastaza, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 18.5 s to 28.1 s | The recordist shortened the pauses between songs. |
| Crypturellus variegatus | [XC257248](https://xeno-canto.org/257248) | John V. Moore | Orellana: Laguna Añangu ('Napo Wildlife Center'), s-bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 2.1 s to 11.5 s |  |
| Nyctidromus albicollis | [XC257769](https://xeno-canto.org/257769) | John V. Moore | Orellana: Laguna Añangu ('Napo Wildlife Center'), s-bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 25.1 s to 31.7 s |  |
| Nyctiphrynus ocellatus | [XC1089640](https://xeno-canto.org/1089640) | Jarol Fernando Vaca | Shiripuno Lodge & Shiripuno Research Center, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 0.0 s to 6.6 s |  |
| Micrastur gilvicollis | [XC260354](https://xeno-canto.org/260354) | Mitch Lysinger | Orellana: 'Tiputini Biodiversity Station', Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 11.8 s to 20.5 s | Recorded at Tiputini Biodiversity Station itself. |
| Xiphorhynchus guttatus | [XC264574](https://xeno-canto.org/264574) | Paul Coopmans | Orellana: Laguna Añangu ('Napo Wildlife Center'), s-bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 17.1 s to 25.8 s |  |
| Ramphastos tucanus | [XC258025](https://xeno-canto.org/258025) | John V. Moore | Orellana: Laguna Añangu ('Napo Wildlife Center'), s-bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 1.1 s to 8.8 s |  |
| Lipaugus vociferans | [XC746003](https://xeno-canto.org/746003) | Patricio Mena Valenzuela | Sucumbios: Palma Roja, Reserva de Producción de Fauna Cuyabeno, 250 m, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 1.4 s to 7.9 s |  |
| Cyphorhinus arada | [XC264794](https://xeno-canto.org/264794) | Paul Coopmans | Sucumbíos: 'La Selva Jungle Lodge', n bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 6.8 s to 15.4 s |  |
| Formicarius analis | [XC249134](https://xeno-canto.org/249134) | Niels Krabbe | Orellana: 'Maxus' road km 37 (27 km SSE Pompeya), Ecuador | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 0.1 s to 7.6 s |  |
| Ara macao | [XC257634](https://xeno-canto.org/257634) | John V. Moore | Sucumbíos: 'La Selva Jungle Lodge', n bank Río Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 0.8 s to 7.4 s |  |
| Psarocolius angustifrons | [XC1176196](https://xeno-canto.org/1176196) | Juan Freile | Pastaza: Kapawi area, left bank Río Pastaza, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 0.7 s to 7.3 s |  |
| Plecturocebus discolor | [XC1186115](https://xeno-canto.org/1186115) | Juan Freile | Orellana: Zancudococha (Laguna Iripari), Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 0.5 s to 9.1 s | These are alarm calls, not the morning duet: no duet recording with a usable licence was found. |
| Potos flavus | [XC1180859](https://xeno-canto.org/1180859) | Juan Freile | San Isidro lodge, Napo, Ecuador | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 14.4 s to 21.0 s | Recorded on the Andean slope of Ecuador, not in the lowlands. |
| Leptodactylus pentadactylus | [XC1091528](https://xeno-canto.org/1091528) | Tristan Guillebot de Nerville | Sinnamary, Arrondissement of Cayenne, French Guiana | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 11.2 s to 17.9 s | From French Guiana. |
| Boana lanciformis | [XC1051344](https://xeno-canto.org/1051344) | Fabrice Schmitt | Raimondi (near Oventeni), Atalaya, Ucayali, Peru | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 17.3 s to 23.9 s | From Ucayali, Peru. |
| Boana boans | [XC1050023](https://xeno-canto.org/1050023) | Fabrice Schmitt | Yuyapichis District, Puerto Inca Province, Huanuco, Peru | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 46.9 s to 53.5 s | From Huánuco, Peru. |
| Rhinella marina | [XC1051348](https://xeno-canto.org/1051348) | Fabrice Schmitt | Raimondi (near Oventeni), Atalaya, Ucayali, Peru | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 13.3 s to 20.9 s | From Ucayali, Peru. |
| Callimedusa tomopterna | [XC882732](https://xeno-canto.org/882732) | M.S. Hoogmoed | Rondônia, 10 kilometer east of Porto Velho, Brazil | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 116.6 s to 123.3 s | A 1985 tape from Rondônia, Brazil. |

Thank you to the recordists. Without them this would be a silent forest.

## Voices that are not recordings

| What | How it is made | Why |
| --- | --- | --- |
| Katydids, crickets, cicadas | Synthesised in the browser from pulse trains (`src/audio/synth.ts`) | No identified recording from Yasuní with a usable licence; xeno-canto does not host cicadas |
| Rain, dripping leaves, thunder, wind, river, stream, footsteps, a breaking branch, a falling tree, something moving off | Synthesised from filtered noise | |
| Manaus slender-legged tree frog, white-lined leaf frog, triangle tree frog, Amazon milk frog, Ecuador poison frog, Spix's night monkey | Silent | The only recordings found are NoDerivatives, of doubtful identification, or share the tape with another species |
| Chestnut short-tailed bat | Silent | It calls above human hearing |

## Data and sources

Listed with links in the [README](README.md#sources) and, per species, in [`src/core/species.ts`](src/core/species.ts).
iNaturalist records are the work of its observers and identifiers; counts were read from research-grade observations inside the Yasuní Biosphere Reserve.

## Software and type

- [three.js](https://threejs.org/) (MIT), [Vite](https://vite.dev/) (MIT), [Vitest](https://vitest.dev/) (MIT).
- [Cormorant](https://github.com/CatharsisFonts/Cormorant) by Christian Thalmann and [Geist](https://vercel.com/font), both SIL Open Font License 1.1, via Fontsource.
