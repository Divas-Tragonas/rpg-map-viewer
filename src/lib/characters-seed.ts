/**
 * Fitxes de la colla de DIVAS y TRAGONAS, copiades de la base de Notion (pàgina de cada
 * personatge, apartat «Fitxa de personatge») el 2 de novembre de 2026. Les fa servir el back
 * office (`/admin/personatges` → «Importar les fitxes de Notion») per crear les que encara no
 * hi són. Un cop a la API, la font de veritat és la API: aquest fitxer no s'ha de mantenir.
 *
 * ⚠️ La propietat «Nivell» de Notion diu una altra cosa (p. ex. «7/trickery cleric») que no lliga
 * amb la fitxa (Mago 1): aquí hi ha el que diu la fitxa.
 */
import type { ApiCharacterInput } from '@/lib/api';
import type { CharacterSheet } from '@/lib/characters';

type Seed = Omit<ApiCharacterInput, 'sheet' | 'portrait'> & { sheet: CharacterSheet };

export const CHARACTER_SEED: Seed[] = [
  {
    name: 'Jaume III', player: 'Eudald', race: 'Humà', className: 'Guerrer 1', level: 1,
    hpMax: 12, ac: 17, speed: 30, passivePerception: 13,
    notionUrl: 'https://app.notion.com/p/30bdcaf8e68281fd85fcd79fedcd81fc',
    sheet: {
      background: 'Noble', alignment: 'Legal neutral', initiative: '-1', profBonus: '+2', hitDie: '1d10',
      abilities: { str: 16, dex: 9, con: 15, int: 11, wis: 13, cha: 14 }, saves: ['str', 'con'],
      sections: [
        { title: 'Habilitats', text: 'Atletismo +5 ✦ · Historia +2 ✦ · Persuasión +4 ✦ · Perspicacia +3 ✦\nLa cota de malles dóna desavantatge a Sigilo' },
        { title: 'Atacs', text: '- **Gran hacha** +5 · 1d12+3 tallant\n- **Javalina** +5 · 1d6+3 perforant (llançament 30/120 peus)' },
        { title: 'Equip', text: "Cota de malles, gran hacha (herència familiar), 3 javalinas, mochila, manta, yesca, racions 2 dies, odre d'aigua, vestidures fines, segell (anell), pergamí de genealogia" },
        { title: 'Trets', text: "- **Segundo Aire:** acció addicional per recuperar 1d10 + nivell de guerrer en PV (1 cop per descans curt o llarg)\n- **Estilo de Combate (Defensa):** +1 a la CA mentre porta armadura (ja inclòs)\n- **Posición de Privilegio:** és benvingut a l'alta societat; la gent tendeix a pensar el millor d'ell" },
        { title: 'Idiomes i competències', text: '**Idiomes:** Comú, Dracònic, Nan\n**Competències:** totes les armadures, escuts, armes simples, armes marcials, cartes' },
        { title: 'Personalitat', text: "**Trets:** els seus elogis fan que les persones se sentin importants. No li agrada embrutar-se i prefereix caure mort que allotjar-se en llocs inapropiats.\n**Ideal:** Responsabilitat. És el deure d'un noble protegir la gent del poble, no intimidar-la.\n**Vincle:** la gran hacha és una herència familiar i la seva possessió més preuada.\n**Defecte:** li costa resistir l'encís de les riqueses, especialment l'or.\n**Meta:** Civilitzar Phentanil: aportar llei i ordre al poble." },
        { title: 'Trasfons', text: 'Fill de noblesa. Procedent de Corliin Hill (a SempreEstiu).\nObjectius: governar Phentanil i acabar amb l\'alcalde corrupte.' },
      ],
    },
  },
  {
    name: 'Liriandor Líadon', player: 'Carlos', race: 'Alt elf', className: 'Mag 1', level: 1,
    hpMax: 8, ac: 12, speed: 30, passivePerception: 13,
    notionUrl: 'https://app.notion.com/p/30bdcaf8e68281348392f161a2f44b42',
    sheet: {
      background: 'Acòlit', alignment: 'Caòtic bo', initiative: '+2', profBonus: '+2', hitDie: '1d6',
      abilities: { str: 10, dex: 15, con: 14, int: 16, wis: 12, cha: 8 }, saves: ['int', 'wis'],
      sections: [
        { title: 'Habilitats', text: 'Arcanos +5 ✦ · Historia +5 ✦ · Investigación +5 ✦ · Religión +5 ✦ · Medicina +3' },
        { title: 'Atacs', text: "- **Espada corta** +4 · 1d6+2 perforant\n- **Conjurs d'atac:** bonus +5 · CD de salvació 13" },
        { title: 'Màgia', text: "**Trucs (a voluntat):** Mano del mago, Prestidigitación, Rayo de escarcha, Contacto electrizante\n**Espais de conjur de nivell 1:** 2\n**Conjurs al llibre:** Armadura del mago, Detectar magia, Dormir, Escudo, Manos ardientes, Proyectil mágico\n**Conjurs preparats (4):** a escollir del llibre cada dia" },
        { title: 'Equip', text: "Espada corta, bossa de components de conjurs, llibre de conjurs, motxilla, tinta, ploma, 10 fulls de pergamí, ganivet petit, tom de saber històric, símbol sagrat, llibre d'oracions, roba comuna, bossa" },
        { title: 'Trets', text: "- **Recuperación Arcana:** 1 cop al dia en un descans curt, recupera espais de conjur de nivell combinat ≤ la meitat del seu nivell de mag\n- **Visión en la Oscuridad:** veu en penombra com amb llum brillant (60 peus) i en la foscor com en penombra\n- **Linaje Feérico:** avantatge contra ser encantat; la màgia no el pot adormir\n- **Trance:** no dorm; medita 4 hores i en té prou\n- **Refugio de los Fieles:** cura i atencions gratuïtes als temples d'Oghma" },
        { title: 'Idiomes i competències', text: '**Idiomes:** Comú, Èlfic, Dracònic, Nan, Goblin\n**Competències:** daga, dards, ballesta lleugera, arc llarg, espasa llarga, bastó, arc curt, espasa curta, fona' },
        { title: 'Personalitat', text: "**Trets:** fa servir paraules polisil·làbiques per semblar erudit. Ha passat tant de temps al temple que li costa tractar amb la gent de manera casual.\n**Ideal:** Coneixement. El camí cap al poder i la millora personal és el coneixement.\n**Vincle:** el tom que porta és el registre de tota la seva vida.\n**Defecte:** farà gairebé qualsevol cosa per descobrir secrets històrics.\n**Meta:** Reconsagrar l'altar d'Oghma profanat pels goblins al Castell Cragmaw." },
        { title: 'Trasfons', text: "Ha dedicat la vida a Oghma, déu de la saviesa. Té 107 anys (als 100 es fa adult) i ho apunta tot al seu llibre. Un cop adult, ha sortit al món per aprendre el coneixement del multivers." },
      ],
    },
  },
  {
    name: 'Yunquerin Trotamentera', player: 'Enric', race: 'Nan de les colines', className: 'Clergue 1', level: 1,
    hpMax: 11, ac: 18, speed: 25, passivePerception: 13,
    notionUrl: 'https://app.notion.com/p/30bdcaf8e682813c921bc2f7c85046b8',
    sheet: {
      background: 'Soldat', alignment: 'Neutral bo', initiative: '-1', profBonus: '+2', hitDie: '1d8',
      abilities: { str: 14, dex: 8, con: 15, int: 10, wis: 16, cha: 12 }, saves: ['wis', 'cha'],
      sections: [
        { title: 'Habilitats', text: 'Atletismo +4 ✦ · Perspicacia +5 ✦ · Medicina +5 ✦ · Religión +2 ✦ · Historia +2\nLa cota de malles dóna desavantatge a Sigilo' },
        { title: 'Atacs', text: "- **Martell de guerra** +4 · 1d8+2 contundent\n- **Hacha de mà** +4 · 1d6+2 tallant (llançament 20/60 peus)\n- **Conjurs d'atac:** bonus +5 · CD de salvació 13" },
        { title: 'Màgia', text: '**Trucs (a voluntat):** Llum, Llama sagrada, Taumaturgia\n**Espais de conjur de nivell 1:** 2\n**Conjurs de domini sempre preparats:** Bendecir, Curar heridas\n**Conjurs preparats (4):** a escollir de la llista de clergue cada dia' },
        { title: 'Equip', text: "Cota de malles, escut, martell de guerra, 2 hachas de mà, símbol sagrat, motxilla, palanqueta, martell, 10 pitons, 10 torxes, esca, racions 10 dies, odre d'aigua, 50 peus de corda de cànem, eines de paleta, daga trofeu d'un enemic, joc de cartes, roba comuna, bossa, insígnia de rang (sergent)" },
        { title: 'Trets', text: "- **Discípulo de la Vida:** els conjurs de curació restauren 2 + nivell del conjur PV addicionals\n- **Visión en la Oscuridad:** veu en penombra com amb llum brillant (60 peus)\n- **Resiliencia Enana:** avantatge contra verí i resistència al dany de verí\n- **Dureza Enana:** +1 PV màxims per nivell (ja inclòs)\n- **Sargento Mercenario:** els soldats de Mintarn reconeixen la seva autoritat\n- **Afinidad con la Piedra:** bonus de competència doble en Història sobre pedra o construcció\n- **Dominio Vida:** devot de Marthammor Duin, déu nan dels viatgers" },
        { title: 'Idiomes i competències', text: '**Idiomes:** Comú, Nan\n**Competències:** totes les armadures i escuts, armes simples, destral de batalla, destral de mà, martells lleugers i de guerra, cartes, eines de paleta, vehicles terrestres' },
        { title: 'Personalitat', text: "**Trets:** sempre educat i respectuós. No confia en els seus instints i tendeix a esperar que els altres actuïn primer.\n**Ideal:** Respecte. La gent mereix ser tractada amb dignitat i cortesia.\n**Vincle:** té tres cosins (Gundren, ara presoner al Castell de la Fumarola, Tharden i Nundro Rockseeker), amics i membres estimats del clan.\n**Defecte:** en secret es pregunta si als déus els importen de debò els assumptes dels mortals.\n**Meta:** Donar una lliçó als Caps Roges." },
      ],
    },
  },
  {
    name: 'Espardeny Llepamabre', player: 'Martí', race: 'Humà', className: 'Guerrer 1', level: 1,
    hpMax: 12, ac: 14, speed: 30, passivePerception: 13,
    notionUrl: 'https://app.notion.com/p/30fdcaf8e682800691e3e32bd536f398',
    sheet: {
      background: 'Heroi del poble', alignment: 'Legal bo', initiative: '+3', profBonus: '+2', hitDie: '1d10',
      abilities: { str: 14, dex: 16, con: 15, int: 11, wis: 13, cha: 9 }, saves: ['str', 'con'],
      sections: [
        { title: 'Habilitats', text: 'Atletismo +4 ✦ · Percepción +3 ✦ · Supervivencia +3 ✦ · Acrobacias +3' },
        { title: 'Atacs', text: '- **Espadón** +4 · 2d6+2 tallant\n- **Arc llarg** +7 · 1d8+3 perforant (abast 150/600 peus)' },
        { title: 'Equip', text: "Armadura de cuir, arc llarg, 20 fletxes, espadón, motxilla, sac de dormir, estris de cuina, esca, 10 torxes, racions 10 dies, odre d'aigua, 50 peus de corda de cànem, eines de fuster, pala, olla de ferro, roba comuna, bossa" },
        { title: 'Trets', text: "- **Segundo Aire:** acció addicional per recuperar 1d10 + nivell de guerrer en PV (1 cop per descans curt o llarg)\n- **Estilo de Combate (Arquería):** +2 a l'atac amb armes a distància (inclòs a l'arc)\n- **Hospitalidad Rústica:** troba refugi entre la gent del poble, que la protegirà de la llei si cal" },
        { title: 'Idiomes i competències', text: '**Idiomes:** Comú, Èlfic\n**Competències:** totes les armadures, escuts, armes simples i marcials, eines de fuster, vehicles terrestres' },
        { title: 'Personalitat', text: "**Trets:** quan fixa la ment en alguna cosa, la persegueix. Intenta semblar intel·ligent amb paraules llargues.\n**Ideal:** Sinceritat. No és bo fingir ser qui no ets.\n**Vincle:** un dia, Pineda del Tro tornarà a ser un poble pròsper, amb una estàtua seva a la plaça.\n**Defecte:** convençut de la importància del seu destí, no veu les seves limitacions.\n**Meta:** Espantar el drac de la Torre Vella de Pineda del Tro i provar que és un heroi de debò." },
        { title: 'Trasfons', text: 'Va conèixer Sildar a Neverwinter defensant treballadors del port davant d\'abusos d\'autoritat.' },
      ],
    },
  },
  {
    name: 'Cigarramic Capllimat', player: 'Pau', race: 'Mitjà peus lleugers', className: 'Pícar 1', level: 1,
    hpMax: 9, ac: 14, speed: 25, passivePerception: 10,
    notionUrl: 'https://app.notion.com/p/30fdcaf8e682801393b9de85cc8d5f95',
    sheet: {
      background: 'Criminal', alignment: 'Neutral', initiative: '+3', profBonus: '+2', hitDie: '1d8',
      abilities: { str: 8, dex: 16, con: 12, int: 13, wis: 10, cha: 16 }, saves: ['dex', 'cha'],
      sections: [
        { title: 'Habilitats', text: 'Acrobacias +5 ✦ · Engaño +5 ✦ · Juego de Manos +5 ✦ · Persuasión +5 ✦ · **Sigilo +7 ✦✦** (pericia)' },
        { title: 'Atacs', text: '- **Espada corta** +5 · 1d6+3 perforant\n- **Arc curt** +5 · 1d6+3 perforant (abast 80/320 peus)\n- **Atac furtiu:** +1d6 amb avantatge o amb un aliat al costat de l\'objectiu' },
        { title: 'Equip', text: "Espada corta, arc curt, 20 fletxes, armadura de cuir, eines de lladre, motxilla, 5 espelmes, palanqueta, martell, 10 pitons, 50 peus de corda de cànem, llanterna sorda, 2 flascons d'oli, racions 5 dies, esca, odre d'aigua, roba fosca amb caputxa, bossa\n**Monedes:** 10 PP" },
        { title: 'Trets', text: "- **Suerte:** amb un 1 natural en un d20, pot tornar a tirar\n- **Valiente:** avantatge contra ser espantat\n- **Agilidad de Mediano:** pot passar per l'espai de criatures més grans\n- **Sigiloso por Naturaleza:** es pot amagar darrere de criatures més grans\n- **Contacto Criminal:** intermediari d'una xarxa criminal\n- **Pericia:** bonus doble a Sigilo i eines de lladre\n- **Canto de Ladrones:** coneix el cant dels lladres" },
        { title: 'Idiomes i competències', text: "**Idiomes:** Comú, Mitjà\n**Competències:** armadures lleugeres, armes simples, ballestes de mà, espases llargues, roperes i curtes, eines de lladre, cartes, eines de fuster" },
        { title: 'Personalitat', text: "**Trets:** mai té un pla, però és molt bo improvisant. La millor manera de fer-li fer una cosa és dir-li que no pot.\n**Ideal:** La gent. Lleial als amics, no als ideals.\n**Vincle:** la seva tia té una granja a Phentanil i sempre li dona part dels guanys il·lícits.\n**Defecte:** la seva tia no ha de saber mai què va fer amb els Caps Roges.\n**Meta:** Venjança: descobrir qui el va trair als Caps Roges." },
      ],
    },
  },
];
