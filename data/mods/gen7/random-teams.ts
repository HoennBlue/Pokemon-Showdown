/* eslint max-len: ["error", 255] */

import {RandomTeams, TeamData} from '../../random-teams';
import {PRNG, PRNGSeed} from '../../../sim/prng';
import {Utils} from '../../../lib/utils';

export class RandomGen7Teams extends RandomTeams {
	randomFactorySets: AnyObject;
	randomBSSFactorySets: AnyObject;
	randomOMFactorySets: AnyObject;
	constructor(format: Format | string, prng: PRNG | PRNGSeed | null) {
		super(format, prng);
		this.randomFactorySets = require('./factory-sets.json');
		this.randomBSSFactorySets = require('./bss-factory-sets.json');
		this.randomOMFactorySets = require('./om-factory-sets.json');
	}
	randomSet(species: string | Species, teamDetails: RandomTeamsTypes.TeamDetails = {}, isLead = false, isDoubles = false): RandomTeamsTypes.RandomSet {
		species = this.dex.getSpecies(species);
		let forme = species.name;

		if (species.battleOnly && typeof species.battleOnly === 'string') {
			// Only change the forme. The species has custom moves, and may have different typing and requirements.
			forme = species.battleOnly;
		}
		if (species.cosmeticFormes) {
			forme = this.sample([species.name].concat(species.cosmeticFormes));
		}

		const movePool = isDoubles && species.randomDoubleBattleMoves ? species.randomDoubleBattleMoves.slice() : species.randomBattleMoves ? species.randomBattleMoves.slice() : Object.keys(this.dex.getLearnsetData(species.id).learnset || {});
		const rejectedPool = [];
		const moves: string[] = [];
		let ability = '';
		let item = '';
		const evs = {
			hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85,
		};
		const ivs = {
			hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31,
		};
		const hasType: {[k: string]: true} = {};
		hasType[species.types[0]] = true;
		if (species.types[1]) {
			hasType[species.types[1]] = true;
		}
		const hasAbility: {[k: string]: true} = {};
		hasAbility[species.abilities[0]] = true;
		if (species.abilities[1]) {
			hasAbility[species.abilities[1]] = true;
		}
		if (species.abilities['H']) {
			hasAbility[species.abilities['H']] = true;
		}
		let availableHP = 0;
		for (const moveid of movePool) {
			if (moveid.startsWith('hiddenpower')) availableHP++;
		}

		// These moves can be used even if we aren't setting up to use them:
		const SetupException = ['closecombat', 'diamondstorm', 'extremespeed', 'superpower', 'clangingscales', 'dracometeor'];

		const counterAbilities = ['Adaptability', 'Contrary', 'Iron Fist', 'Skill Link', 'Strong Jaw'];
		const ateAbilities = ['Aerilate', 'Galvanize', 'Pixilate', 'Refrigerate'];

		let hasMove: {[k: string]: boolean} = {};
		let counter;

		do {
			// Keep track of all moves we have:
			hasMove = {};
			for (const moveid of moves) {
				if (moveid.startsWith('hiddenpower')) {
					hasMove['hiddenpower'] = true;
				} else {
					hasMove[moveid] = true;
				}
			}

			// Choose next 4 moves from learnset/viable moves and add them to moves list:
			while (moves.length < 4 && movePool.length) {
				const moveid = this.sampleNoReplace(movePool);
				if (moveid === 'curse') {
					if (this.format.id.endsWith('proteanpalacerandombattle')) continue;
					if (this.format.id.endsWith('foreststreatrandombattle') && !hasType['Ghost']) continue;
				}
				if (moveid === 'stickyweb' && this.format.id.endsWith('slowmonsrandombattle')) continue;
				if (moveid === 'freezedry' && (this.format.id.endsWith('inverserandombattle') || this.format.id.endsWith('polaropposites'))) continue;
				if ((moveid === 'aromatherapy' || moveid === 'healbell' || moveid === 'willowisp') && this.format.id.endsWith('burningmonrandombattle')) continue;
				if (moveid.startsWith('hiddenpower')) {
					availableHP--;
					if (hasMove['hiddenpower']) continue;
					hasMove['hiddenpower'] = true;
				} else {
					hasMove[moveid] = true;
				}
				moves.push(moveid);
			}
			while (moves.length < 4 && rejectedPool.length) {
				const moveid = this.sampleNoReplace(rejectedPool);
				hasMove[moveid] = true;
				moves.push(moveid);
			}

			counter = this.queryMoves(moves, hasType, hasAbility, movePool);

			// Iterate through the moves again, this time to cull them:
			for (const [k, moveId] of moves.entries()) {
				const move = this.dex.getMove(moveId);
				const moveid = move.id;
				let rejected = false;
				let isSetup = false;

				switch (moveid) {
				// Not very useful without their supporting moves
				case 'clangingscales': case 'electricterrain': case 'happyhour': case 'holdhands': case 'mindblown':
					if (teamDetails.zMove || hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					break;
				case 'cottonguard': case 'defendorder':
					if (!counter['recovery'] && !hasMove['rest']) rejected = true;
					break;
				case 'bounce': case 'dig': case 'fly':
					if (teamDetails.zMove || counter.setupType !== 'Physical') rejected = true;
					break;
				case 'focuspunch':
					if (!hasMove['substitute'] || counter.damagingMoves.length < 2) rejected = true;
					break;
				case 'icebeam':
					if (hasAbility['Tinted Lens'] && !!counter['Status']) rejected = true;
					break;
				case 'perishsong':
					if (!hasMove['protect']) rejected = true;
					break;
				case 'reflect':
					if (!hasMove['calmmind'] && !hasMove['lightscreen']) rejected = true;
					if (movePool.length > 1) {
						const screen = movePool.indexOf('lightscreen');
						if (screen >= 0) this.fastPop(movePool, screen);
					}
					break;
				case 'rest':
					if (movePool.includes('sleeptalk')) rejected = true;
					break;
				case 'sleeptalk':
					if (!hasMove['rest']) rejected = true;
					if (movePool.length > 1) {
						const rest = movePool.indexOf('rest');
						if (rest >= 0) this.fastPop(movePool, rest);
					}
					break;
				case 'storedpower':
					if (!counter.setupType) rejected = true;
					break;
				case 'switcheroo': case 'trick':
					if (counter.Physical + counter.Special < 3 || hasMove['electroweb'] || hasMove['snarl'] || hasMove['suckerpunch']) rejected = true;
					break;

				// Set up once and only if we have the moves for it
				case 'bellydrum': case 'bulkup': case 'coil': case 'curse': case 'dragondance': case 'honeclaws': case 'swordsdance':
					if (counter.setupType !== 'Physical' || counter['physicalsetup'] > 1) rejected = true;
					if (counter.Physical + counter['physicalpool'] < 2 && (!hasMove['rest'] || !hasMove['sleeptalk'])) rejected = true;
					if (moveid === 'bellydrum' && !hasAbility['Unburden'] && !counter['priority']) rejected = true;
					isSetup = true;
					break;
				case 'calmmind': case 'geomancy': case 'nastyplot': case 'quiverdance': case 'tailglow':
					if (counter.setupType !== 'Special' || counter['specialsetup'] > 1) rejected = true;
					if (counter.Special + counter['specialpool'] < 2 && (!hasMove['rest'] || !hasMove['sleeptalk'])) rejected = true;
					if (hasType['Dark'] && hasMove['darkpulse']) {
						counter.setupType = 'Special';
						rejected = false;
					}
					isSetup = true;
					break;
				case 'growth': case 'shellsmash': case 'workup':
					if (counter.setupType !== 'Mixed' || counter['mixedsetup'] > 1) rejected = true;
					if (counter.damagingMoves.length + counter['physicalpool'] + counter['specialpool'] < 2) rejected = true;
					if (moveid === 'growth' && !hasMove['sunnyday']) rejected = true;
					isSetup = true;
					break;
				case 'agility': case 'autotomize': case 'rockpolish': case 'shiftgear':
					if (counter.damagingMoves.length < 2 || hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					if (!counter.setupType) isSetup = true;
					break;
				case 'flamecharge':
					if (counter.damagingMoves.length < 3 && !counter.setupType) rejected = true;
					if (hasMove['dracometeor'] || hasMove['overheat']) rejected = true;
					break;

				// Bad after setup
				case 'circlethrow': case 'dragontail':
					if (counter.setupType && ((!hasMove['rest'] && !hasMove['sleeptalk']) || hasMove['stormthrow'])) rejected = true;
					if (!!counter['speedsetup'] || hasMove['encore'] || hasMove['raindance'] || hasMove['roar'] || hasMove['trickroom'] || hasMove['whirlwind']) rejected = true;
					if ((counter[move.type] > 1 && counter.Status > 1) || hasAbility['Sheer Force'] && !!counter['sheerforce']) rejected = true;
					if (isDoubles && hasMove['superpower']) rejected = true;
					break;
				case 'defog':
					if (counter.setupType || hasMove['spikes'] || hasMove['stealthrock'] || teamDetails.defog) rejected = true;
					break;
				case 'fakeout': case 'tailwind':
					if (counter.setupType || hasMove['substitute'] || hasMove['switcheroo'] || hasMove['trick']) rejected = true;
					break;
				case 'foulplay':
					if (counter.setupType || !!counter['speedsetup'] || counter['Dark'] > 2 || hasMove['clearsmog'] || hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					if (counter.damagingMoves.length - 1 === counter['priority']) rejected = true;
					break;
				case 'haze': case 'spikes':
					if (counter.setupType || !!counter['speedsetup'] || hasMove['trickroom']) rejected = true;
					break;
				case 'healbell': case 'technoblast':
					if (counter['speedsetup']) rejected = true;
					break;
				case 'healingwish': case 'memento':
					if (counter.setupType || !!counter['recovery'] || hasMove['substitute']) rejected = true;
					break;
				case 'helpinghand':
					if (counter.setupType) rejected = true;
					break;
				case 'icywind': case 'stringshot':
					if (!!counter['speedsetup'] || hasMove['trickroom']) rejected = true;
					break;
				case 'leechseed': case 'roar': case 'whirlwind':
					if (counter.setupType || !!counter['speedsetup'] || hasMove['dragontail']) rejected = true;
					if (isDoubles && (movePool.includes('protect') || movePool.includes('spikyshield'))) rejected = true;
					break;
				case 'nightshade': case 'seismictoss': case 'superfang':
					if (!hasAbility['Parental Bond'] && (counter.damagingMoves.length > 1 || counter.setupType)) rejected = true;
					break;
				case 'protect':
					if (counter.setupType && !hasMove['wish'] && !isDoubles) rejected = true;
					if (!!counter['speedsetup'] || hasMove['rest'] || hasMove['lightscreen'] && hasMove['reflect']) rejected = true;
					if (isDoubles && (hasMove['fakeout'] || movePool.includes('bellydrum') || movePool.includes('shellsmash') || hasMove['tailwind'] && hasMove['roost'])) rejected = true;
					break;
				case 'pursuit':
					if (counter.setupType || counter.Status > 1 || counter['Dark'] > 2 || hasMove['knockoff'] && !hasType['Dark']) rejected = true;
					break;
				case 'rapidspin':
					if (counter.setupType || teamDetails.rapidSpin) rejected = true;
					break;
				case 'reversal':
					if (hasMove['substitute'] && teamDetails.zMove) rejected = true;
					break;
				case 'stealthrock':
					if (counter.setupType || !!counter['speedsetup'] || hasMove['rest'] || hasMove['substitute'] || hasMove['trickroom'] || teamDetails.stealthRock) rejected = true;
					break;
				case 'stickyweb':
					if (teamDetails.stickyWeb) rejected = true;
					break;
				case 'toxicspikes':
					if (counter.setupType || teamDetails.toxicSpikes) rejected = true;
					break;
				case 'trickroom':
					if (counter.setupType || !!counter['speedsetup'] || counter.damagingMoves.length < 2) rejected = true;
					if (hasMove['lightscreen'] || hasMove['reflect']) rejected = true;
					break;
				case 'uturn':
					if (counter.setupType || !!counter['speedsetup'] || hasType['Bug'] && counter.stab < 2 && counter.damagingMoves.length > 2 && !hasAbility['Adaptability'] && !hasAbility['Download']) rejected = true;
					if ((hasAbility['Speed Boost'] && hasMove['protect']) || (hasAbility['Protean'] && counter.Status > 2)) rejected = true;
					break;
				case 'voltswitch':
					if (counter.setupType || !!counter['speedsetup'] || hasMove['electricterrain'] || hasMove['raindance'] || hasMove['uturn']) rejected = true;
					break;

				// Bit redundant to have both
				// Attacks:
				case 'bugbite': case 'bugbuzz': case 'infestation': case 'signalbeam':
					if (hasMove['uturn'] && !counter.setupType && !hasAbility['Tinted Lens']) rejected = true;
					break;
				case 'darkestlariat': case 'nightslash':
					if (hasMove['knockoff'] || hasMove['pursuit']) rejected = true;
					break;
				case 'darkpulse':
					if ((hasMove['crunch'] || hasMove['knockoff'] || hasMove['hyperspacefury']) && counter.setupType !== 'Special') rejected = true;
					break;
				case 'suckerpunch':
					if (counter.damagingMoves.length < 2 || hasMove['glare'] || !hasType['Dark'] && counter['Dark'] > 1) rejected = true;
					break;
				case 'dragonclaw':
					if (hasMove['dragontail'] || hasMove['outrage']) rejected = true;
					break;
				case 'dracometeor':
					if (hasMove['swordsdance'] || counter.setupType === 'Physical' && counter['Dragon'] > 1) rejected = true;
					break;
				case 'dragonpulse': case 'spacialrend':
					if (hasMove['dracometeor'] || hasMove['outrage'] || hasMove['dragontail'] && !counter.setupType) rejected = true;
					break;
				case 'outrage':
					if (hasMove['dracometeor'] && counter.damagingMoves.length < 3) rejected = true;
					if (hasMove['clangingscales'] && !teamDetails.zMove) rejected = true;
					break;
				case 'thunderbolt':
					if (hasMove['discharge'] || (hasMove['voltswitch'] && hasMove['wildcharge'])) rejected = true;
					break;
				case 'thunderpunch':
					if (hasAbility['Galvanize'] && !!counter['Normal']) rejected = true;
					break;
				case 'moonblast':
					if (isDoubles && hasMove['dazzlinggleam']) rejected = true;
					break;
				case 'aurasphere': case 'focusblast':
					if ((hasMove['closecombat'] || hasMove['superpower']) && counter.setupType !== 'Special') rejected = true;
					if (hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					break;
				case 'drainpunch':
					if (!hasMove['bulkup'] && (hasMove['closecombat'] || hasMove['highjumpkick'])) rejected = true;
					if ((hasMove['focusblast'] || hasMove['superpower']) && counter.setupType !== 'Physical') rejected = true;
					break;
				case 'closecombat': case 'highjumpkick':
					if ((hasMove['aurasphere'] || hasMove['focusblast'] || movePool.includes('aurasphere') || movePool.includes('focusblast')) && counter.setupType === 'Special') rejected = true;
					if (hasMove['bulkup'] && hasMove['drainpunch']) rejected = true;
					break;
				case 'stormthrow':
					if (hasMove['circlethrow'] && hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					break;
				case 'superpower':
					if (counter['Fighting'] > 1 && counter.setupType) rejected = true;
					if (hasMove['rest'] && hasMove['sleeptalk'] && !hasAbility['Contrary']) rejected = true;
					if (hasAbility['Contrary']) isSetup = true;
					break;
				case 'vacuumwave':
					if ((hasMove['closecombat'] || hasMove['machpunch']) && counter.setupType !== 'Special') rejected = true;
					break;
				case 'fierydance': case 'firefang': case 'firepunch': case 'flamethrower':
					if (hasMove['blazekick'] || hasMove['heatwave'] || hasMove['overheat']) rejected = true;
					if ((hasMove['fireblast'] || hasMove['lavaplume']) && counter.setupType !== 'Physical') rejected = true;
					break;
				case 'fireblast': case 'magmastorm':
					if (hasMove['flareblitz'] && counter.setupType !== 'Special') rejected = true;
					if (hasMove['lavaplume'] && !counter.setupType && !counter['speedsetup']) rejected = true;
					if (hasMove['mindblown'] && !teamDetails.zMove) rejected = true;
					break;
				case 'heatwave':
					if (isDoubles && hasMove['fireblast']) rejected = true;
					break;
				case 'lavaplume':
					if (hasMove['firepunch'] || hasMove['fireblast'] && (counter.setupType || !!counter['speedsetup'])) rejected = true;
					break;
				case 'overheat':
					if (hasMove['fireblast'] || hasMove['flareblitz'] || hasMove['lavaplume']) rejected = true;
					break;
				case 'hurricane':
					if (hasMove['bravebird']) rejected = true;
					break;
				case 'hex':
					if (!hasMove['willowisp']) rejected = true;
					break;
				case 'shadowball':
					if (hasMove['darkpulse'] || hasMove['hex'] && hasMove['willowisp']) rejected = true;
					break;
				case 'shadowclaw':
					if (hasMove['shadowforce'] || hasMove['shadowsneak']) rejected = true;
					if (hasMove['shadowball'] && counter.setupType !== 'Physical') rejected = true;
					break;
				case 'shadowsneak':
					if (hasType['Ghost'] && species.types.length > 1 && counter.stab < 2) rejected = true;
					if (hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					break;
				case 'gigadrain':
					if (hasMove['petaldance'] || hasMove['powerwhip'] || (hasMove['seedbomb'] && !isDoubles)) rejected = true;
					if (hasMove['leafstorm'] && counter.Special < 4 && !counter.setupType && !hasMove['trickroom']) rejected = true;
					break;
				case 'leafblade': case 'woodhammer':
					if (hasMove['gigadrain'] && counter.setupType !== 'Physical') rejected = true;
					if (hasMove['hornleech'] && counter.Physical < 4) rejected = true;
					break;
				case 'leafstorm':
					if (hasMove['trickroom'] || counter['Grass'] > 1 && counter.setupType) rejected = true;
					if (isDoubles && hasMove['energyball']) rejected = true;
					break;
				case 'seedbomb':
					if (isDoubles && hasMove['gigadrain']) rejected = true;
					break;
				case 'solarbeam':
					if ((!hasAbility['Drought'] && !hasMove['sunnyday']) || hasMove['gigadrain'] || hasMove['leafstorm']) rejected = true;
					break;
				case 'bonemerang': case 'precipiceblades':
					if (hasMove['earthquake']) rejected = true;
					break;
				case 'earthpower':
					if (hasMove['earthquake'] && counter.setupType !== 'Special') rejected = true;
					break;
				case 'earthquake':
					if (isDoubles && hasMove['highhorsepower']) rejected = true;
					break;
				case 'freezedry':
					if (hasMove['icebeam'] || hasMove['icywind'] || counter.stab < 2) rejected = true;
					break;
				case 'bodyslam': case 'return':
					if (hasMove['doubleedge'] || hasMove['glare'] && hasMove['headbutt']) rejected = true;
					if (moveid === 'return' && hasMove['bodyslam']) rejected = true;
					break;
				case 'endeavor':
					if (!isLead && !hasAbility['Defeatist']) rejected = true;
					break;
				case 'explosion':
					if (counter.setupType || (hasAbility['Refrigerate'] && hasMove['freezedry']) || hasMove['wish']) rejected = true;
					break;
				case 'extremespeed':
					if (counter.setupType !== 'Physical' && hasMove['vacuumwave']) rejected = true;
					break;
				case 'facade':
					if (hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					break;
				case 'hiddenpower':
					if (hasMove['rest'] || !counter.stab && counter.damagingMoves.length < 2) rejected = true;
					break;
				case 'hypervoice':
					if (hasMove['blizzard'] || hasMove['return']) rejected = true;
					break;
				case 'judgment':
					if (counter.setupType !== 'Special' && counter.stab > 1) rejected = true;
					break;
				case 'quickattack':
					if (hasType['Normal'] && (!counter.stab || counter['Normal'] > 2)) rejected = true;
					if (hasMove['feint'] || hasType['Rock'] && !!counter.Status) rejected = true;
					break;
				case 'weatherball':
					if (!hasMove['raindance'] && !hasMove['sunnyday']) rejected = true;
					break;
				case 'poisonjab':
					if (hasMove['gunkshot']) rejected = true;
					break;
				case 'acidspray': case 'sludgewave':
					if (hasMove['poisonjab'] || hasMove['sludgebomb']) rejected = true;
					break;
				case 'psychic':
					if (hasMove['psyshock']) rejected = true;
					break;
				case 'psychocut': case 'zenheadbutt':
					if ((hasMove['psychic'] || hasMove['psyshock']) && counter.setupType !== 'Physical') rejected = true;
					if (hasAbility['Contrary'] && !counter.setupType && !!counter['physicalpool']) rejected = true;
					break;
				case 'psyshock':
					const psychic = movePool.indexOf('psychic');
					if (psychic >= 0) this.fastPop(movePool, psychic);
					break;
				case 'headsmash':
					if (hasMove['stoneedge'] || isDoubles && hasMove['rockslide']) rejected = true;
					break;
				case 'rockblast': case 'rockslide':
					if ((hasMove['headsmash'] || hasMove['stoneedge']) && !isDoubles) rejected = true;
					break;
				case 'stoneedge':
					if (isDoubles && hasMove['rockslide']) rejected = true;
					break;
				case 'bulletpunch':
					if (hasType['Steel'] && counter.stab < 2 && !hasAbility['Adaptability'] && !hasAbility['Technician']) rejected = true;
					break;
				case 'flashcannon':
					if ((hasMove['ironhead'] || hasMove['meteormash']) && counter.setupType !== 'Special') rejected = true;
					break;
				case 'hydropump':
					if (hasMove['liquidation'] || hasMove['razorshell'] || hasMove['waterfall'] || (hasMove['rest'] && hasMove['sleeptalk'])) rejected = true;
					if (hasMove['scald'] && ((counter.Special < 4 && !hasMove['uturn']) || (species.types.length > 1 && counter.stab < 3))) rejected = true;
					break;
				case 'muddywater':
					if (isDoubles && (hasMove['scald'] || hasMove['hydropump'])) rejected = true;
					break;
				case 'originpulse': case 'surf':
					if (hasMove['hydropump'] || hasMove['scald']) rejected = true;
					break;
				case 'scald':
					if (hasMove['liquidation'] || hasMove['waterfall'] || hasMove['waterpulse']) rejected = true;
					break;

				// Status:
				case 'electroweb': case 'stunspore': case 'thunderwave':
					if (counter.setupType || !!counter['speedsetup'] || (hasMove['rest'] && hasMove['sleeptalk'])) rejected = true;
					if (hasMove['discharge'] || hasMove['spore'] || hasMove['toxic'] || hasMove['trickroom'] || hasMove['yawn']) rejected = true;
					break;
				case 'glare': case 'headbutt':
					if (hasMove['bodyslam'] || !hasMove['glare']) rejected = true;
					break;
				case 'toxic':
					if (hasMove['hypnosis'] || hasMove['sleeppowder'] || hasMove['willowisp'] || hasMove['yawn']) rejected = true;
					if (counter.setupType || hasMove['flamecharge'] || hasMove['raindance']) rejected = true;
					break;
				case 'willowisp':
					if (hasMove['scald']) rejected = true;
					break;
				case 'raindance':
					if (counter.Physical + counter.Special < 2 || hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					if (!hasType['Water'] && !counter['Water']) rejected = true;
					break;
				case 'sunnyday':
					if (counter.Physical + counter.Special < 2 || hasMove['rest'] && hasMove['sleeptalk']) rejected = true;
					if (!hasAbility['Chlorophyll'] && !hasAbility['Flower Gift'] && !hasMove['solarbeam']) rejected = true;
					if (rejected && movePool.length > 1) {
						const solarbeam = movePool.indexOf('solarbeam');
						if (solarbeam >= 0) this.fastPop(movePool, solarbeam);
						if (movePool.length > 1) {
							const weatherball = movePool.indexOf('weatherball');
							if (weatherball >= 0) this.fastPop(movePool, weatherball);
						}
					}
					break;
				case 'milkdrink': case 'moonlight': case 'painsplit': case 'recover': case 'roost': case 'synthesis':
					if (hasMove['leechseed'] || hasMove['rest'] || hasMove['wish']) rejected = true;
					break;
				case 'safeguard':
					if (hasMove['destinybond']) rejected = true;
					break;
				case 'substitute':
					if (hasMove['dracometeor'] || hasMove['leafstorm'] && !hasAbility['Contrary']) rejected = true;
					if (hasMove['pursuit'] || hasMove['rest'] || hasMove['taunt'] || hasMove['uturn'] || hasMove['voltswitch'] || hasMove['whirlwind']) rejected = true;
					if (movePool.includes('copycat')) rejected = true;
					break;
				case 'powersplit':
					if (hasMove['guardsplit']) rejected = true;
					break;
				case 'wideguard':
					if (hasMove['protect']) rejected = true;
					break;
				}

				// This move doesn't satisfy our setup requirements:
				if ((move.category === 'Physical' && counter.setupType === 'Special') || (move.category === 'Special' && counter.setupType === 'Physical')) {
					// Reject STABs last in case the setup type changes later on
					const stabs = counter[species.types[0]] + (counter[species.types[1]] || 0);
					if (!SetupException.includes(moveid) && (!hasType[move.type] || stabs > 1 || counter[move.category] < 2)) rejected = true;
				}
				// Hidden Power isn't good enough
				if (counter.setupType === 'Special' && moveid === 'hiddenpower' && species.types.length > 1 && counter['Special'] <= 2 && !hasType[move.type] && !counter['Physical'] && counter['specialpool']) {
					rejected = true;
				}

				// Pokemon should have moves that benefit their Type/Ability/Weather, as well as moves required by its forme
				if (!rejected && !['judgment', 'sleeptalk'].includes(moveid) && (
					counter['physicalsetup'] + counter['specialsetup'] < 2 &&
					(!counter.setupType || counter.setupType === 'Mixed' || (move.category !== counter.setupType && move.category !== 'Status') || (counter[counter.setupType] + counter.Status > 3 && !counter.hazards))
				) && (
					(!counter.stab && !hasMove['nightshade'] && !hasMove['seismictoss'] &&
						(species.types.length > 1 || (species.types[0] !== 'Normal' && species.types[0] !== 'Psychic') || !hasMove['icebeam'] || species.baseStats.spa >= species.baseStats.spd)) ||
					(hasType['Bug'] && (movePool.includes('megahorn') || movePool.includes('pinmissile'))) ||
					((hasType['Dark'] && !counter['Dark'] && !hasAbility['Protean']) || hasMove['suckerpunch'] && !hasAbility['Contrary'] && counter.stab < species.types.length) ||
					(hasType['Dragon'] && !counter['Dragon'] && !hasAbility['Aerilate'] && !hasAbility['Pixilate'] && !hasMove['fly'] && !hasMove['rest'] && !hasMove['sleeptalk']) ||
					(hasType['Electric'] && !hasAbility['Galvanize'] && (!counter['Electric'] || movePool.includes('thunder'))) ||
					(hasType['Fairy'] && !counter['Fairy'] && !hasAbility['Pixilate'] && (counter.setupType || !counter['Status'])) ||
					(hasType['Fighting'] && !counter['Fighting'] && (species.baseStats.atk >= 110 || hasAbility['Justified'] || hasAbility['Unburden'] || counter.setupType || !counter['Status'])) ||
					(hasType['Fire'] && !counter['Fire']) ||
					(hasType['Flying'] && !counter['Flying'] && (hasAbility['Gale Wings'] || hasAbility['Serene Grace'] || (hasType['Normal'] && (movePool.includes('beakblast') || movePool.includes('bravebird'))))) ||
					(hasType['Ghost'] && !hasType['Dark'] && !counter['Ghost'] && !hasAbility['Steelworker']) ||
					(hasType['Grass'] && !counter['Grass'] && !hasType['Fairy'] && !hasType['Poison'] && !hasType['Steel']) ||
					(hasType['Ground'] && !counter['Ground'] && !hasMove['rest'] && !hasMove['sleeptalk']) ||
					(hasType['Ice'] && !counter['Ice'] && !hasAbility['Refrigerate']) ||
					(hasType['Normal'] && (movePool.includes('boomburst') || hasAbility['Guts'] && movePool.includes('facade'))) ||
					(hasType['Poison'] && !counter['Poison'] && (movePool.includes('gunkshot') || hasAbility['Sheer Force'] || counter.setupType)) ||
					(hasType['Psychic'] && !!counter['Psychic'] && (movePool.includes('psychicfangs') || !hasType['Flying'] && !hasAbility['Pixilate'] && counter.stab < species.types.length)) ||
					(hasType['Rock'] && !counter['Rock'] && !hasType['Fairy'] && (species.baseStats.atk >= 105 || hasAbility['Rock Head'] || counter.setupType === 'Physical')) ||
					(((hasType['Steel'] && (hasAbility['Technician'] || hasMove['trickroom'])) || hasAbility['Steelworker']) && !counter['Steel']) ||
					(hasType['Water'] && (!counter['Water'] || !counter.stab) && !hasAbility['Protean']) ||
					(hasAbility['Adaptability'] && !counter.setupType && species.types.length > 1 && (!counter[species.types[0]] || !counter[species.types[1]])) ||
					((hasAbility['Aerilate'] || (hasAbility['Galvanize'] && !counter['Electric']) || hasAbility['Pixilate'] || (hasAbility['Refrigerate'] && !hasMove['blizzard'])) && !counter['Normal']) ||
					(hasAbility['Contrary'] && !counter['contrary'] && species.name !== 'Shuckle') ||
					(hasAbility['Psychic Surge'] && !counter['Psychic']) ||
					(hasAbility['Slow Start'] && movePool.includes('substitute')) ||
					((movePool.includes('recover') || movePool.includes('roost') || movePool.includes('softboiled')) &&
						!counter.setupType && !hasMove['healingwish'] && !hasMove['trick'] && (counter.Status > 1 || (species.nfe && !!counter['Status']))) ||
					(movePool.includes('stickyweb') && !counter.setupType && !teamDetails.stickyWeb) ||
					(species.requiredMove && movePool.includes(toID(species.requiredMove)))
				)) {
					// Reject Status or non-STAB
					if (!isSetup && !move.weather && !move.sideCondition && !move.stallingMove && !move.damage && (move.category !== 'Status' || !move.flags.heal)) {
						if (move.category === 'Status' || move.selfSwitch || !hasType[move.type] || move.basePower && move.basePower < 40 && !move.multihit) {
							rejected = true;
						}
					}
				}

				// Sleep Talk shouldn't be selected without Rest
				if (moveid === 'rest' && rejected) {
					const sleeptalk = movePool.indexOf('sleeptalk');
					if (sleeptalk >= 0) {
						if (movePool.length < 2) {
							rejected = false;
						} else {
							this.fastPop(movePool, sleeptalk);
						}
					}
				}

				// Remove rejected moves from the move list
				if (rejected && (movePool.length - availableHP || availableHP && (moveid === 'hiddenpower' || !hasMove['hiddenpower']))) {
					if (move.category !== 'Status' && !move.damage && !move.flags.charge && (moveid !== 'hiddenpower' || !availableHP)) {
						rejectedPool.push(moves[k]);
					}
					moves.splice(k, 1);
					break;
				}
				if (rejected && rejectedPool.length) {
					moves.splice(k, 1);
					break;
				}
			}
		} while (moves.length < 4 && (movePool.length || rejectedPool.length));

		// Moveset modifications
		if (hasMove['autotomize'] && hasMove['heavyslam']) {
			if (species.id === 'celesteela') {
				moves[moves.indexOf('heavyslam')] = 'flashcannon';
			} else {
				moves[moves.indexOf('autotomize')] = 'rockpolish';
			}
		}
		if (hasMove['raindance'] && hasMove['thunderbolt'] && !isDoubles) {
			moves[moves.indexOf('thunderbolt')] = 'thunder';
		}
		if (hasMove['workup'] && !counter['Special'] && species.id === 'zeraora') {
			moves[moves.indexOf('workup')] = 'bulkup';
		}

		if (this.format.id.endsWith('returndrandombattle')) {
			const getBenefit = (move: Move) => !move.multihit && move.basePower && move.basePower - 102 || 0;
			moves.sort((a, b) => getBenefit(this.dex.getMove(a)) - getBenefit(this.dex.getMove(b)));
		}

		const baseSpecies: Species = species.battleOnly && !species.requiredAbility ? this.dex.getSpecies(species.battleOnly as string) : species;
		const abilities: string[] = Object.values(baseSpecies.abilities);
		abilities.sort((a, b) => this.dex.getAbility(b).rating - this.dex.getAbility(a).rating);
		let ability0 = this.dex.getAbility(abilities[0]);
		let ability1 = this.dex.getAbility(abilities[1]);
		let ability2 = this.dex.getAbility(abilities[2]);
		if (abilities[1]) {
			if (abilities[2] && ability1.rating <= ability2.rating && this.randomChance(1, 2)) {
				[ability1, ability2] = [ability2, ability1];
			}
			if (ability0.rating <= ability1.rating && this.randomChance(1, 2)) {
				[ability0, ability1] = [ability1, ability0];
			} else if (ability0.rating - 0.6 <= ability1.rating && this.randomChance(2, 3)) {
				[ability0, ability1] = [ability1, ability0];
			}
			ability = ability0.name;

			let rejectAbility;
			do {
				rejectAbility = false;
				if (counterAbilities.includes(ability)) {
					// Adaptability, Contrary, Iron Fist, Skill Link, Strong Jaw
					rejectAbility = !counter[toID(ability)];
				} else if (ateAbilities.includes(ability)) {
					rejectAbility = !counter['Normal'];
				} else if (ability === 'Battle Armor' || ability === 'Sturdy') {
					rejectAbility = (!!counter['recoil'] && !counter['recovery']);
				} else if (ability === 'Battle Bond' || ability === 'Flare Boost' || ability === 'Moody') {
					rejectAbility = true;
				} else if (ability === 'Chlorophyll' || ability === 'Leaf Guard') {
					rejectAbility = (species.baseStats.spe > 100 || abilities.includes('Harvest') || !hasMove['sunnyday'] && !teamDetails['sun']);
				} else if (ability === 'Competitive') {
					rejectAbility = (!counter['Special'] || hasMove['rest'] && hasMove['sleeptalk']);
				} else if (ability === 'Compound Eyes' || ability === 'No Guard') {
					rejectAbility = !counter['inaccurate'];
				} else if (ability === 'Defiant' || ability === 'Moxie') {
					rejectAbility = !counter['Physical'] || hasMove['dragontail'];
				} else if (ability === 'Download' || ability === 'Hyper Cutter') {
					rejectAbility = species.nfe;
				} else if (ability === 'Gluttony') {
					rejectAbility = !hasMove['bellydrum'];
				} else if (ability === 'Harvest') {
					rejectAbility = abilities.includes('Frisk');
				} else if (ability === 'Hustle') {
					rejectAbility = counter.Physical < 2;
				} else if (ability === 'Hydration' || ability === 'Rain Dish' || ability === 'Swift Swim') {
					rejectAbility = (species.baseStats.spe > 100 || !hasMove['raindance'] && !teamDetails['rain']);
				} else if (ability === 'Ice Body' || ability === 'Slush Rush' || ability === 'Snow Cloak') {
					rejectAbility = !teamDetails['hail'];
				} else if (ability === 'Immunity' || ability === 'Snow Warning') {
					rejectAbility = (hasMove['facade'] || hasMove['hypervoice']);
				} else if (ability === 'Intimidate') {
					rejectAbility = (hasMove['bodyslam'] || hasMove['rest'] || abilities.includes('Reckless') && counter['recoil'] > 1);
				} else if (ability === 'Lightning Rod') {
					rejectAbility = species.types.includes('Ground');
				} else if (ability === 'Limber') {
					rejectAbility = species.types.includes('Electric');
				} else if (ability === 'Liquid Voice') {
					rejectAbility = !counter['sound'];
				} else if (ability === 'Magic Guard' || ability === 'Speed Boost') {
					rejectAbility = (hasAbility['Tinted Lens'] && (!counter['Status'] || hasMove['uturn']));
				} else if (ability === 'Magician') {
					rejectAbility = hasMove['switcheroo'];
				} else if (ability === 'Magnet Pull') {
					rejectAbility = (!!counter['Normal'] || !hasType['Electric'] && !hasMove['earthpower']);
				} else if (ability === 'Mold Breaker') {
					rejectAbility = (hasMove['acrobatics'] || abilities.includes('Adaptability') || abilities.includes('Sheer Force') && !!counter['sheerforce']);
				} else if (ability === 'Overgrow') {
					rejectAbility = !counter['Grass'];
				} else if (ability === 'Poison Heal') {
					rejectAbility = (abilities.includes('Technician') && !!counter['technician']);
				} else if (ability === 'Power Construct') {
					rejectAbility = species.baseSpecies !== 'Zygarde' || species.forme === '10%' && !hasMove['substitute'];
				} else if (ability === 'Prankster') {
					rejectAbility = !counter['Status'];
				} else if (ability === 'Pressure' || ability === 'Synchronize') {
					rejectAbility = (counter.Status < 2 || !!counter['recoil'] || species.isMega);
				} else if (ability === 'Regenerator') {
					rejectAbility = abilities.includes('Magic Guard');
				} else if (ability === 'Quick Feet') {
					rejectAbility = hasMove['bellydrum'];
				} else if (ability === 'Reckless' || ability === 'Rock Head') {
					rejectAbility = (!counter['recoil'] || species.isMega);
				} else if (ability === 'Sand Force' || ability === 'Sand Rush' || ability === 'Sand Veil') {
					rejectAbility = !teamDetails['sand'];
				} else if (ability === 'Scrappy') {
					rejectAbility = !species.types.includes('Normal');
				} else if (ability === 'Serene Grace') {
					rejectAbility = (!counter['serenegrace'] || species.name === 'Blissey');
				} else if (ability === 'Sheer Force') {
					rejectAbility = (!counter['sheerforce'] || abilities.includes('Guts') || hasMove['doubleedge'] || species.isMega);
				} else if (ability === 'Simple') {
					rejectAbility = (!counter.setupType && !hasMove['flamecharge']);
				} else if (ability === 'Solar Power') {
					rejectAbility = (!counter['Special'] || !teamDetails['sun'] || species.isMega);
				} else if (ability === 'Swarm') {
					rejectAbility = (!counter['Bug'] || species.isMega);
				} else if (ability === 'Sweet Veil') {
					rejectAbility = hasType['Grass'];
				} else if (ability === 'Technician') {
					rejectAbility = (!counter['technician'] || hasMove['tailslap'] || species.isMega);
				} else if (ability === 'Tinted Lens') {
					rejectAbility = ((abilities.includes('Magic Guard') && !!counter['Status']) || abilities.includes('Prankster') || hasMove['protect'] || !!counter['damage'] || counter.Status > 2 && !counter.setupType);
				} else if (ability === 'Torrent') {
					rejectAbility = (!counter['Water'] || species.isMega);
				} else if (ability === 'Unaware') {
					rejectAbility = hasMove['stealthrock'];
				} else if (ability === 'Unburden') {
					rejectAbility = (abilities.includes('Prankster') || (!counter.setupType && !hasMove['acrobatics']) || species.isMega);
				} else if (ability === 'Water Absorb') {
					rejectAbility = (abilities.includes('Volt Absorb') || hasMove['raindance']);
				} else if (ability === 'Weak Armor') {
					rejectAbility = counter.setupType !== 'Physical';
				}

				if (rejectAbility) {
					if (ability === ability0.name && ability1.rating >= 1) {
						ability = ability1.name;
					} else if (ability === ability1.name && abilities[2] && ability2.rating >= 1) {
						ability = ability2.name;
					} else {
						// Default to the highest rated ability if all are rejected
						ability = abilities[0];
						rejectAbility = false;
					}
				}
			} while (rejectAbility);

			if (abilities.includes('Guts') && ability !== 'Quick Feet' && (hasMove['facade'] || (hasMove['protect'] && !isDoubles) || (hasMove['rest'] && hasMove['sleeptalk']))) {
				ability = 'Guts';
			} else if (abilities.includes('Triage') && !!counter['drain']) {
				ability = 'Triage';
			} else if (isDoubles) {
				if (abilities.includes('Intimidate')) ability = 'Intimidate';
				if (abilities.includes('Guts') && ability !== 'Intimidate') ability = 'Guts';
				if (abilities.includes('Storm Drain')) ability = 'Storm Drain';
				if (abilities.includes('Harvest')) ability = 'Harvest';
				if (abilities.includes('Unburden') && ability !== 'Prankster' && !species.isMega) ability = 'Unburden';
			}
			if (species.name === 'Ambipom' && !counter['technician']) {
				// If it doesn't qualify for Technician, Skill Link is useless on it
				ability = 'Pickup';
			} else if (species.name === 'Lopunny' && hasMove['switcheroo'] && this.randomChance(2, 3)) {
				ability = 'Klutz';
			}
		} else {
			ability = ability0.name;
		}

		item = isDoubles ? 'Sitrus Berry' : 'Leftovers';
		if (species.requiredItems) {
			if (species.baseSpecies === 'Arceus' && (hasMove['judgment'] || !counter[species.types[0]] || teamDetails.zMove)) {
				// Judgment doesn't change type with Z-Crystals
				item = species.requiredItems[0];
			} else {
				item = this.sample(species.requiredItems);
			}
		} else if (species.inheritedItem && (hasMove['judgment'] || hasMove['multiattack'] || hasMove['technoblast'])) {
			item = species.inheritedItem;
		} else if (ability === 'Levitate' && hasType['Flying']) {
			// This is just to amuse Zarel
			item = 'Air Balloon';

		// First, the extra high-priority items
		} else if (species.baseSpecies === 'Cubone' || species.baseSpecies === 'Marowak') {
			item = 'Thick Club';
		} else if (species.name === 'Decidueye' && hasMove['spiritshackle'] && counter.setupType && !teamDetails.zMove) {
			item = 'Decidium Z';
		} else if (ability === 'Cheek Pouch') {
			item = 'Petaya Berry';
		} else if (species.name === 'Deoxys-Attack') {
			item = (isLead && hasMove['stealthrock']) ? 'Focus Sash' : 'Life Orb';
		} else if (species.name === 'Farfetch\u2019d') {
			item = 'Stick';
		} else if (species.name === 'Genesect' && hasMove['technoblast']) {
			item = 'Douse Drive';
			forme = 'Genesect-Douse';
		} else if (species.name === 'Kommo-o' && !teamDetails.zMove) {
			item = hasMove['clangingscales'] ? 'Kommonium Z' : 'Dragonium Z';
		} else if (species.name === 'Lycanroc' && hasMove['stoneedge'] && counter.setupType && !teamDetails.zMove) {
			item = 'Lycanium Z';
		} else if (species.baseSpecies === 'Marowak') {
			item = 'Thick Club';
		} else if (species.name === 'Marshadow' && hasMove['spectralthief'] && counter.setupType && !teamDetails.zMove) {
			item = 'Marshadium Z';
		} else if (species.name === 'Mimikyu' && hasMove['playrough'] && counter.setupType && !teamDetails.zMove) {
			item = 'Mimikium Z';
		} else if ((species.name === 'Necrozma-Dusk-Mane' || species.name === 'Necrozma-Dawn-Wings') && !teamDetails.zMove) {
			if (hasMove['autotomize'] && hasMove['sunsteelstrike']) {
				item = 'Solganium Z';
			} else if (hasMove['trickroom'] && hasMove['moongeistbeam']) {
				item = 'Lunalium Z';
			} else {
				item = 'Ultranecrozium Z';
				if (!hasMove['photongeyser']) {
					for (const moveid of moves) {
						const move = this.dex.getMove(moveid);
						if (move.category === 'Status' || hasType[move.type]) continue;
						moves[moves.indexOf(moveid)] = 'photongeyser';
						break;
					}
				}
			}
		} else if (species.name === 'Pikachu') {
			if (!isDoubles) forme = `Pikachu${this.sample(['', '-Original', '-Hoenn', '-Sinnoh', '-Unova', '-Kalos', '-Alola', '-Partner'])}`;
			if (forme !== 'Pikachu') ability = 'Static';
			item = 'Light Ball';
		} else if (species.name === 'Porygon-Z' && hasMove['nastyplot'] && !hasMove['trick'] && !['nastyplot', 'icebeam', 'triattack'].includes(moves[0]) && !teamDetails.zMove && !isDoubles) {
			moves[moves.indexOf('nastyplot')] = 'conversion';
			moves[moves.indexOf('triattack')] = 'recover';
			item = 'Normalium Z';
		} else if (species.name === 'Raichu-Alola' && hasMove['thunderbolt'] && counter.setupType && !teamDetails.zMove) {
			item = 'Aloraichium Z';
		} else if (species.name === 'Shedinja' || species.name === 'Smeargle') {
			item = 'Focus Sash';
		} else if (ability === 'Super Luck') {
			item = 'Scope Lens';
		} else if (species.name === 'Unown') {
			item = 'Choice Specs';
		} else if (species.name === 'Wobbuffet') {
			if (hasMove['destinybond']) {
				item = 'Custap Berry';
			} else {
				item = isDoubles || this.randomChance(1, 2) ? 'Sitrus Berry' : 'Leftovers';
			}
		} else if (ability === 'Harvest' || ability === 'Emergency Exit' && !!counter['Status']) {
			item = 'Sitrus Berry';
		} else if (ability === 'Imposter') {
			item = 'Choice Scarf';
		} else if (ability === 'Poison Heal') {
			item = 'Toxic Orb';
		} else if (species.evos.length) {
			item = (ability === 'Technician' && counter.Physical >= 4) ? 'Choice Band' : 'Eviolite';
		} else if (hasMove['switcheroo'] || hasMove['trick']) {
			if (ability === 'Klutz') {
				item = 'Assault Vest';
			} else if (species.baseStats.spe >= 60 && species.baseStats.spe <= 108) {
				item = 'Choice Scarf';
			} else {
				item = (counter.Physical > counter.Special) ? 'Choice Band' : 'Choice Specs';
			}
		} else if (hasMove['bellydrum']) {
			if (ability === 'Gluttony') {
				item = this.sample(['Aguav', 'Figy', 'Iapapa', 'Mago', 'Wiki']) + ' Berry';
			} else if (species.baseStats.spe <= 50 && !teamDetails.zMove && this.randomChance(1, 2)) {
				item = 'Normalium Z';
			} else {
				item = 'Sitrus Berry';
			}
		} else if (hasMove['copycat'] && counter.Physical >= 3) {
			item = 'Choice Band';
		} else if (hasMove['geomancy']) {
			item = 'Power Herb';
		} else if (hasMove['shellsmash']) {
			item = (ability === 'Solid Rock' && !!counter['priority']) ? 'Weakness Policy' : 'White Herb';
		} else if ((ability === 'Guts' || hasMove['facade']) && !hasMove['sleeptalk']) {
			item = (hasType['Fire'] || ability === 'Quick Feet' || ability === 'Toxic Boost') ? 'Toxic Orb' : 'Flame Orb';
		} else if ((ability === 'Magic Guard' && counter.damagingMoves.length > 1) || ability === 'Sheer Force' && !!counter['sheerforce']) {
			item = 'Life Orb';
		} else if (ability === 'Unburden') {
			item = hasMove['fakeout'] ? 'Normal Gem' : 'Sitrus Berry';
		} else if (hasMove['acrobatics']) {
			item = '';
		} else if (((hasMove['darkpulse'] && ability === 'Fur Coat' && counter.setupType) || (hasMove['suckerpunch'] && ability === 'Moxie' && counter['Dark'] < 2)) && !teamDetails.zMove) {
			item = 'Darkinium Z';
		} else if (hasMove['outrage'] && counter.setupType && !hasMove['fly'] && !teamDetails.zMove) {
			item = 'Dragonium Z';
		} else if (hasMove['electricterrain'] || ability === 'Electric Surge' && hasMove['thunderbolt']) {
			item = 'Electrium Z';
		} else if (hasMove['fleurcannon'] && !!counter['speedsetup'] && !teamDetails.zMove) {
			item = 'Fairium Z';
		} else if (((hasMove['focusblast'] && hasMove['nastyplot'] && hasType['Fighting']) || (hasMove['reversal'] && hasMove['substitute'])) && !teamDetails.zMove) {
			item = 'Fightinium Z';
		} else if ((hasMove['magmastorm'] || hasMove['mindblown'] && !!counter['Status']) && !teamDetails.zMove) {
			item = 'Firium Z';
		} else if (!teamDetails.zMove && (hasMove['fly'] || (hasMove['hurricane'] && species.baseStats.spa >= 125 && (!!counter.Status || hasMove['superpower'])) || ((hasMove['bounce'] || hasMove['bravebird']) && counter.setupType))) {
			item = 'Flyinium Z';
		} else if (hasMove['sleeppowder'] && hasType['Grass'] && counter.setupType && species.baseStats.spe <= 70 && !teamDetails.zMove) {
			item = 'Grassium Z';
		} else if (hasMove['dig'] && !teamDetails.zMove) {
			item = 'Groundium Z';
		} else if (hasMove['happyhour'] || hasMove['holdhands'] || hasMove['encore'] && ability === 'Contrary') {
			item = 'Normalium Z';
		} else if (hasMove['photongeyser'] && counter.setupType && !teamDetails.zMove) {
			item = 'Psychium Z';
		} else if (hasMove['hydropump'] && ability === 'Battle Bond' && hasMove['uturn'] && !teamDetails.zMove) {
			item = 'Waterium Z';
		} else if (hasMove['solarbeam'] && ability !== 'Drought' && !hasMove['sunnyday'] && !teamDetails['sun']) {
			item = !teamDetails.zMove ? 'Grassium Z' : 'Power Herb';
		} else if ((hasMove['hail'] || (hasMove['blizzard'] && ability !== 'Snow Warning')) && !teamDetails.zMove) {
			item = 'Icium Z';
		} else if (hasMove['raindance']) {
			if (species.baseSpecies === 'Castform' && !teamDetails.zMove) {
				item = 'Waterium Z';
			} else {
				item = (ability === 'Forecast') ? 'Damp Rock' : 'Life Orb';
			}
		} else if (hasMove['sunnyday']) {
			if ((species.baseSpecies === 'Castform' || species.baseSpecies === 'Cherrim') && !teamDetails.zMove) {
				item = 'Firium Z';
			} else {
				item = (ability === 'Forecast') ? 'Heat Rock' : 'Life Orb';
			}
		} else if (hasMove['auroraveil'] || hasMove['lightscreen'] && hasMove['reflect']) {
			item = 'Light Clay';
		} else if (hasMove['rest'] && !hasMove['sleeptalk'] && ability !== 'Natural Cure' && ability !== 'Shed Skin' && ability !== 'Shadow Tag') {
			item = 'Chesto Berry';
		} else if (!hasType['Fire'] && (ability === 'Guts' && !hasMove['sleeptalk']) || hasMove['psychoshift']) {
			item = 'Flame Orb';
		} else if (!hasType['Poison'] && !hasType['Steel'] && ((ability === 'Guts' || hasMove['Facade']) && !hasMove['sleeptalk'] || hasMove['psychoshift'])) {
			item = 'Toxic Orb';
		} else if (ability === 'Unburden') {
			if (hasMove['fakeout']) {
				item = 'Normal Gem';
			} else {
				item = 'Sitrus Berry';
			}
		} else if (hasMove['acrobatics']) {
			item = '';

		// Medium priority
		} else if ((ability === 'Speed Boost' || ability === 'Stance Change' || species.name === 'Pheromosa') && counter.Physical + counter.Special > 2 && !hasMove['uturn']) {
			item = 'Life Orb';
		} else if (isDoubles && hasMove['uturn'] && counter.Physical === 4) {
			item = (species.baseStats.spe >= 60 && species.baseStats.spe <= 108 && !counter['priority'] && this.randomChance(1, 2)) ? 'Choice Scarf' : 'Choice Band';
		} else if (isDoubles && counter.Special === 4 && hasMove['waterspout'] || hasMove['eruption']) {
			item = 'Choice Scarf';
		} else if (counter.Physical >= 4 && !hasMove['bodyslam'] && !hasMove['dragontail'] && !hasMove['fakeout'] && !hasMove['flamecharge'] && !hasMove['rapidspin'] && !hasMove['suckerpunch'] && !isDoubles) {
			item = (species.baseStats.atk >= 100 || ability === 'Huge Power') && species.baseStats.spe >= 60 && species.baseStats.spe <= 108 && !counter['priority'] && this.randomChance(2, 3) ? 'Choice Scarf' : 'Choice Band';
		} else if (counter.Special >= 4 && !hasMove['acidspray'] && !hasMove['clearsmog'] && !hasMove['fierydance'] && !isDoubles) {
			item = species.baseStats.spa >= 100 && species.baseStats.spe >= 60 && species.baseStats.spe <= 108 && ability !== 'Tinted Lens' && !counter['priority'] && this.randomChance(2, 3) ? 'Choice Scarf' : 'Choice Specs';
		} else if (counter.Physical >= 3 && hasMove['defog'] && species.baseStats.spe >= 60 && species.baseStats.spe <= 108 && !counter['priority'] && !hasMove['foulplay'] && !isDoubles) {
			item = 'Choice Scarf';
		} else if (counter.Special >= 3 && hasMove['uturn'] && !hasMove['acidspray']) {
			item = (isDoubles && this.randomChance(1, 3)) ? 'Choice Scarf' : 'Choice Specs';
		} else if ((ability === 'Drizzle' || ability === 'Slow Start' || hasMove['bite'] || hasMove['clearsmog'] || hasMove['curse'] || hasMove['protect'] || hasMove['sleeptalk'] || species.name.includes('Rotom-')) && !isDoubles) {
			item = 'Leftovers';
		} else if ((hasMove['endeavor'] || hasMove['flail'] || hasMove['reversal']) && ability !== 'Sturdy') {
			item = (ability === 'Defeatist') ? 'Expert Belt' : 'Focus Sash';
		} else if (hasMove['outrage'] && counter.setupType) {
			item = 'Lum Berry';
		} else if (isDoubles && counter.damagingMoves.length >= 3 && species.baseStats.spe >= 70 && ability !== 'Multiscale' && ability !== 'Sturdy' && !hasMove['acidspray'] && !hasMove['electroweb'] && !hasMove['fakeout'] &&
			!hasMove['feint'] && !hasMove['flamecharge'] && !hasMove['icywind'] && !hasMove['incinerate'] && !hasMove['naturesmadness'] && !hasMove['rapidspin'] && !hasMove['snarl'] && !hasMove['suckerpunch'] && !hasMove['uturn']) {
			item = (species.baseStats.hp + species.baseStats.def + species.baseStats.spd >= 275) ? 'Sitrus Berry' : 'Life Orb';
		} else if (hasMove['substitute']) {
			item = counter.damagingMoves.length > 2 && !!counter['drain'] ? 'Life Orb' : 'Leftovers';
		} else if (this.dex.getEffectiveness('Ground', species) >= 2 && ability !== 'Levitate' && !hasMove['magnetrise'] && !isDoubles) {
			item = 'Air Balloon';
		} else if ((ability === 'Iron Barbs' || ability === 'Rough Skin') && this.randomChance(1, 2)) {
			item = 'Rocky Helmet';
		} else if (counter.Physical + counter.Special >= 4 && species.baseStats.spd >= 50 && species.baseStats.hp + species.baseStats.def + species.baseStats.spd >= 235) {
			item = 'Assault Vest';
		} else if ((species.name === 'Latias' || species.name === 'Latios') && !!counter['Dragon'] && !!counter['Psychic']) {
			item = 'Soul Dew';
		} else if (species.name === 'Palkia' && (hasMove['dracometeor'] || hasMove['spacialrend']) && hasMove['hydropump']) {
			item = 'Lustrous Orb';
		} else if (counter.damagingMoves.length >= 4) {
			item = (!!counter['Dragon'] || !!counter['Dark'] || !!counter['Normal']) ? 'Life Orb' : 'Expert Belt';
		} else if (counter.damagingMoves.length >= 3 && !!counter['speedsetup'] && species.baseStats.hp + species.baseStats.def + species.baseStats.spd >= 300) {
			item = 'Weakness Policy';
		} else if (isLead && !isDoubles && ability !== 'Regenerator' && ability !== 'Sturdy' && !counter['recoil'] && !counter['recovery'] && species.baseStats.hp + species.baseStats.def + species.baseStats.spd <= 275) {
			item = 'Focus Sash';

		// This is the "REALLY can't think of a good item" cutoff
		} else if (hasMove['stickyweb'] && ability === 'Sturdy') {
			item = 'Mental Herb';
		} else if (ability === 'Serene Grace' && hasMove['airslash'] && species.baseStats.spe > 100) {
			item = 'Metronome';
		} else if (ability === 'Sturdy' && hasMove['explosion'] && !counter['speedsetup']) {
			item = 'Custap Berry';
		} else if (ability === 'Super Luck') {
			item = 'Scope Lens';
		} else if (!isDoubles && counter.damagingMoves.length >= 3 && ability !== 'Sturdy' && !hasMove['acidspray'] && !hasMove['dragontail'] && !hasMove['foulplay'] && !hasMove['rapidspin'] && !hasMove['superfang'] && !hasMove['uturn']) {
			if (!!counter['speedsetup'] || hasMove['trickroom'] || species.baseStats.spe > 40 && species.baseStats.hp + species.baseStats.def + species.baseStats.spd <= 275) item = 'Life Orb';
		}

		// For Trick / Switcheroo
		if (item === 'Leftovers' && hasType['Poison'] && !this.format.id.endsWith('proteanpalacerandombattle')) {
			item = 'Black Sludge';
		}
		if (item === 'Choice Scarf' && this.format.id.endsWith('slowmonsrandombattle')) {
			item = 'Macho Brace';
		}

		let level: number;

		if (!isDoubles) {
			const levelScale: {[k: string]: number} = {
				uber: 78, ou: 80, uu: 82, ru: 84, nu: 86, pu: 88,
			};
			const customScale: {[k: string]: number} = {
				// Banned Ability
				Dugtrio: 82, Gothitelle: 82, Pelipper: 84, Politoed: 84, Wobbuffet: 82,
				// Holistic judgement
				Castform: 100, Delibird: 100, Spinda: 100, Unown: 100,
			};
			let tier = species.tier as string;
			if (tier.includes('Unreleased') && species.battleOnly) {
				tier = this.dex.getSpecies(species.baseSpecies).tier;
			}
			if (tier.charAt(0) === '(') {
				tier = tier.slice(1, -1);
			}
			level = levelScale[tier] || 90;
			if (customScale[forme]) level = customScale[forme];

			// Custom level based on moveset
			if (species.name === 'Zygarde-10%' && ability === 'Power Construct') level = 80;
		} else {
			// We choose level based on BST. Min level is 70, max level is 99. 600+ BST is 70, less than 300 is 99. Calculate with those values.
			// Every 10.34 BST adds a level from 70 up to 99. Results are floored. Uses the Mega's stats if holding a Mega Stone
			let baseStats = species.baseStats;
			// If Wishiwashi, use the school-forme's much higher stats
			if (species.baseSpecies === 'Wishiwashi') baseStats = this.dex.getSpecies('wishiwashischool').baseStats;

			let bst = baseStats.hp + baseStats.atk + baseStats.def + baseStats.spa + baseStats.spd + baseStats.spe;
			// Adjust levels of mons based on abilities (Pure Power, Sheer Force, etc.) and also Eviolite
			// For the stat boosted, treat the Pokemon's base stat as if it were multiplied by the boost. (Actual effective base stats are higher.)
			const speciesAbility = (baseSpecies === species ? ability : species.abilities[0]);
			if (speciesAbility === 'Huge Power' || speciesAbility === 'Pure Power') {
				bst += baseStats.atk;
			} else if (speciesAbility === 'Parental Bond') {
				bst += 0.25 * (counter.Physical > counter.Special ? baseStats.atk : baseStats.spa);
			} else if (speciesAbility === 'Protean') {
				bst += 0.3 * (counter.Physical > counter.Special ? baseStats.atk : baseStats.spa);
			} else if (speciesAbility === 'Fur Coat') {
				bst += baseStats.def;
			} else if (speciesAbility === 'Slow Start') {
				bst -= baseStats.atk / 2 + baseStats.spe / 2;
			} else if (speciesAbility === 'Truant') {
				bst *= 2 / 3;
			}
			if (item === 'Eviolite') {
				bst += 0.5 * (baseStats.def + baseStats.spd);
			} else if (item === 'Light Ball') {
				bst += baseStats.atk + baseStats.spa;
			}
			level = 70 + Math.floor(((600 - Utils.clampIntRange(bst, 300, 600)) / 10.34));
		}

		if (species.name === 'Stunfisk') {
			// This is just to amuse Zarel
			ability = 'Limber';
			item = 'Cheri Berry';
			level += 2;
		}

		// Prepare optimal HP
		const srWeakness = this.dex.getEffectiveness('Rock', species);
		while (evs.hp > 1) {
			const hp = Math.floor(Math.floor(2 * species.baseStats.hp + ivs.hp + Math.floor(evs.hp / 4) + 100) * level / 100 + 10);
			if (hasMove['substitute'] && hasMove['reversal']) {
				// Reversal users should be able to use four Substitutes
				if (hp % 4 > 0) break;
			} else if (hasMove['substitute'] && (item === 'Petaya Berry' || item === 'Sitrus Berry' || ability === 'Power Construct' && item !== 'Leftovers')) {
				// Three Substitutes should activate Petaya Berry for Dedenne
				// Two Substitutes should activate Sitrus Berry or Power Construct
				if (hp % 4 === 0) break;
			} else if (hasMove['bellydrum'] && (item === 'Sitrus Berry' || ability === 'Gluttony')) {
				// Belly Drum should activate Sitrus Berry
				if (hp % 2 === 0) break;
			} else {
				// Maximize number of Stealth Rock switch-ins
				if (srWeakness <= 0 || hp % (4 / srWeakness) > 0) break;
			}
			evs.hp -= 4;
		}

		// Minimize confusion damage
		if (!counter['Physical'] && !hasMove['copycat'] && !hasMove['transform']) {
			evs.atk = 0;
			ivs.atk = 0;
		}

		if (ability === 'Beast Boost' && counter.Special < 1) {
			evs.spa = 0;
			ivs.spa = 0;
		}

		if (hasMove['gyroball'] || hasMove['metalburst'] || hasMove['trickroom']) {
			evs.spe = 0;
			ivs.spe = 0;
		}

		return {
			name: species.baseSpecies,
			species: forme,
			gender: species.gender,
			moves: moves,
			ability: ability,
			evs: evs,
			ivs: ivs,
			item: item,
			level: level,
			shiny: this.randomChance(1, 1024),
		};
	}

	randomArceusTeam() {
		const natures = Object.keys(this.dex.data.Natures);
		const arceus = ['arceus'].concat(this.dex.getSpecies('arceus').otherFormes || []);
		const team = [];
		for (let i = 0; i < 6; i++) {
			const species = this.dex.getSpecies(this.sampleNoReplace(arceus));

			const item = species.requiredItems ? species.requiredItems[0] : 'Normalium Z';

			// Random EVs
			const evs: StatsTable = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
			const s: StatName[] = ["hp", "atk", "def", "spa", "spd", "spe"];
			let evpool = 510;
			do {
				const x = s[this.random(s.length)];
				const y = this.random(Math.min(256 - evs[x], evpool + 1));
				evs[x] += y;
				evpool -= y;
			} while (evpool > 0);

			// Random IVs
			const ivs = {hp: this.random(32), atk: this.random(32), def: this.random(32), spa: this.random(32), spd: this.random(32), spe: this.random(32)};

			// Random nature
			const nature = natures[this.random(natures.length)];

			// Random happiness
			const happiness = this.random(256);

			// Random shininess
			const shiny = !this.random(1024);

			team.push({
				name: species.baseSpecies,
				species: species.name,
				gender: species.gender,
				item: item,
				ability: 'Multitype',
				moves: ['Metronome'],
				evs: evs,
				ivs: ivs,
				nature: nature,
				level: 100,
				happiness: happiness,
				shiny: shiny,
			});
		}
		return team;
	}

	randomReliableTeam() {
		const pokemon = [];

		const excludedTiers = ['NFE', 'LC Uber', 'LC'];
		const allowedNFE = ['Chansey', 'Doublade', 'Gligar', 'Porygon2', 'Scyther', 'Togetic'];

		const availableFormes: {[k: string]: string[]} = {};
		for (const id in this.dex.data.FormatsData) {
			const template = this.dex.getSpecies(id);
			if (!excludedTiers.includes(template.tier) && !template.isMega && !template.isPrimal && !template.isNonstandard && template.randomBattleMoves) {
				if (!availableFormes[template.baseSpecies]) {
					availableFormes[template.baseSpecies] = [id];
				} else {
					availableFormes[template.baseSpecies].push(id);
				}
			}
		}
		const pokemonPool = Object.values(availableFormes);

		// PotD stuff
		let potd;
		if (global.Config && Config.potd && this.dex.getRuleTable(this.format).has('potd')) {
			potd = this.dex.getSpecies(Config.potd);
		}

		const typeCount: {[k: string]: number} = {};
		const typeComboCount: {[k: string]: number} = {};
		const baseFormes: {[k: string]: number} = {};
		let uberCount = 0;
		let puCount = 0;
		const teamDetails: RandomTeamsTypes.TeamDetails = {};

		while (pokemonPool.length && pokemon.length < 6) {
			let template = this.dex.getSpecies(this.sample(this.sampleNoReplace(pokemonPool)));
			if (!template.exists) continue;

			// Useless in Random Battle without greatly lowering the levels of everything else
			if (template.name === 'Unown') continue;

			// Only certain NFE Pokemon are allowed
			if (template.evos.length && !allowedNFE.includes(template.name)) continue;

			const tier = template.tier;
			switch (tier) {
			case 'Uber':
				// Ubers are limited to 2 but have a 20% chance of being added anyway.
				if (uberCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'PU':
				// PUs are limited to 2 but have a 20% chance of being added anyway.
				if (puCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'Unreleased':
				// Unreleased Pokémon have 20% the normal rate
				if (this.random(5) >= 1) continue;
				break;
			case 'CAP':
				// CAPs have 20% the normal rate
				if (this.random(5) >= 1) continue;
			}

			// Limit 2 of any type
			const types = template.types;
			let skip = false;
			for (const type of types) {
				if (typeCount[type] > 1 && this.random(5) >= 1) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			if (potd?.exists) {
				// The Pokemon of the Day belongs in slot 2
				if (pokemon.length === 1) {
					template = potd;
					if (template.name === 'Magikarp') {
						template = Object.assign({}, potd, {randomBattleMoves: ['bounce', 'flail', 'splash', 'magikarpsrevenge']});
					} else if (template.name === 'Delibird') {
						template = Object.assign({}, potd, {randomBattleMoves: ['present', 'bestow']});
					}
				} else if (template.name === potd.name) {
					continue; // No, thanks, I've already got one
				}
			}

			const set = this.randomSet(template, teamDetails, !pokemon.length);

			// Illusion shouldn't be the last Pokemon of the team
			if (set.ability === 'Illusion' && pokemon.length > 4) continue;

			// Limit 1 of any type combination
			let typeCombo = types.slice().sort().join();
			if (set.ability === 'Drought' || set.ability === 'Drizzle' || set.ability === 'Sand Stream') {
				// Drought, Drizzle and Sand Stream don't count towards the type combo limit
				typeCombo = set.ability;
			}
			if (typeCombo in typeComboCount) continue;

			const typedMoves: (Move | null)[] = [null, null];
			for (const moveid of set.moves) {
				const move = this.dex.getMove(moveid);
				if (move.type === types[0] && (!typedMoves[0] || move.basePower > typedMoves[0].basePower)) typedMoves[0] = move;
				if (move.type === types[1] && (!typedMoves[1] || move.basePower > typedMoves[1].basePower)) typedMoves[1] = move;
			}
			let newMoves = [];
			if (typedMoves[0]) newMoves.push(typedMoves[0]);
			if (typedMoves[1]) newMoves.push(typedMoves[1]);
			if (!newMoves[0]) {
				// Could be Protean, Multitype, -ate or hazard setter. For
				// Protean or -ate we want to avoid changing the move's type.
				set.moves = set.moves.sort((a, b) =>
					+(this.dex.getMove(a).category === "Status") -
					+(this.dex.getMove(b).category === "Status"));
			} else {
				if (newMoves[1] && newMoves[1].basePower > newMoves[0].basePower) newMoves = [newMoves[1], newMoves[0]];
				for (const moveid in this.dex.getLearnsetData(template.id).learnset) {
					if (moveid === 'dreameater' || moveid === 'explosion' || moveid === 'focuspunch' || moveid === 'futuresight' || moveid === 'lastresort' || moveid === 'selfdestruct' || moveid === 'synchronoise' || set.moves.includes(moveid)) continue;
					const move = this.dex.getMove(moveid);
					if (move.flags.charge || move.flags.recharge || move.accuracy < 90) continue;
					if (move.category === newMoves[0].category && move.basePower > newMoves[0].basePower) {
						if (newMoves[1]) newMoves[1] = newMoves[0];
						newMoves[0] = move;
					}
				}
				let newMoveIds: string[] = [];
				if (newMoves[0]) {
					newMoveIds[0] = newMoves[0].id;
					if (newMoves[1]) {
						newMoveIds[1] = newMoves[1].id;
						if (this.random(2)) newMoveIds = [newMoveIds[1], newMoveIds[0]];
					}
				}
				for (const moveid of set.moves) {
					if (typedMoves[0] && moveid === typedMoves[0].id) continue;
					if (typedMoves[1] && moveid === typedMoves[1].id) continue;
					if (newMoveIds.length === 1 && types.length === 2 && this.random(2)) {
						newMoveIds.unshift(moveid);
					} else {
						newMoveIds.push(moveid);
					}
				}
				set.moves = newMoveIds;
			}

			if (template.cosmeticFormes) set.species = template.cosmeticFormes[this.random(template.cosmeticFormes.length)];

			// Okay, the set passes, add it to our team
			pokemon.push(set);

			// Now that our Pokemon has passed all checks, we can increment our counters
			baseFormes[template.baseSpecies] = 1;

			// Increment type counters
			for (const type of types) {
				if (type in typeCount) {
					typeCount[type]++;
				} else {
					typeCount[type] = 1;
				}
			}
			typeComboCount[typeCombo] = 1;

			// Increment Uber/NU counters
			if (tier === 'Uber') {
				uberCount++;
			} else if (tier === 'PU') {
				puCount++;
			}

			// Team has weather/hazards
			if (set.ability === 'Snow Warning') teamDetails['hail'] = 1;
			if (set.ability === 'Drizzle' || set.moves.includes('raindance')) teamDetails['rain'] = 1;
			if (set.ability === 'Sand Stream') teamDetails['sand'] = 1;
			if (set.moves.includes('stealthrock')) teamDetails['stealthRock'] = 1;
			if (set.moves.includes('toxicspikes')) teamDetails['toxicSpikes'] = 1;
			if (set.moves.includes('defog')) teamDetails['defog'] = 1;
			if (set.moves.includes('rapidspin')) teamDetails['rapidSpin'] = 1;
		}
		return pokemon;
	}

	randomInheritanceTeam() {
		const pokemon = [];

		const excludedTiers = ['NFE', 'LC Uber', 'LC'];
		if (this.gen > 6) excludedTiers.push('Uber');
		const allowedNFE = ['Chansey', 'Doublade', 'Gligar', 'Porygon2', 'Scyther', 'Togetic'];

		const availableFormes: {[k: string]: string[]} = {};
		for (const id in this.dex.data.FormatsData) {
			const template = this.dex.getSpecies(id);
			if (template.gen <= this.gen && !excludedTiers.includes(template.tier) && !template.isMega && !template.isPrimal && !template.isNonstandard && template.randomBattleMoves) {
				if (!availableFormes[template.baseSpecies]) {
					availableFormes[template.baseSpecies] = [id];
				} else {
					availableFormes[template.baseSpecies].push(id);
				}
			}
		}
		let pokemonPool = Object.values(availableFormes);

		// PotD stuff
		let potd;
		if (global.Config && Config.potd && this.dex.getRuleTable(this.format).has('potd')) {
			potd = this.dex.getSpecies(Config.potd);
		}

		const typeCount: {[k: string]: number} = {};
		const typeComboCount: {[k: string]: number} = {};
		const baseFormes: {[k: string]: number} = {};
		let uberCount = 0;
		let puCount = 0;
		const teamDetails: RandomTeamsTypes.TeamDetails = {};

		while (pokemonPool.length && pokemon.length < 6) {
			const template = this.dex.getSpecies(this.sample(this.sampleNoReplace(pokemonPool)));
			if (!template.exists) continue;

			// Limit to one of each species (Species Clause)
			if (baseFormes[template.baseSpecies]) continue;

			// Useless in Random Battle without greatly lowering the levels of everything else
			if (template.name === 'Unown') continue;

			// Only certain NFE Pokemon are allowed
			if (template.evos.length && !allowedNFE.includes(template.name)) continue;
			const hasAbility: {[k: string]: boolean} = {};
			hasAbility[template.abilities[0]] = true;
			if (template.abilities[1]) {
				hasAbility[template.abilities[1]] = true;
			}
			if (template.abilities['H']) {
				hasAbility[template.abilities['H']] = true;
			}

			let sample;
			let inheritor: Species;
			const samples = [];
			let hasType: {[k: string]: boolean} = {};
			let movePool: string[] = [];
			do {
				const formes = this.sampleNoReplace(pokemonPool) as string[];
				samples.push(formes);
				if (!formes) break;
				sample = this.sample(formes);
				inheritor = this.dex.getSpecies(sample);
				if (!inheritor.exists) continue;
				if (this.gen > 6 && (inheritor.name === 'Kyurem-Black' || inheritor.name === 'Slaking' || inheritor.name === 'Regigigas')) continue;

				hasType = {};
				hasType[inheritor.types[0]] = true;
				if (inheritor.types[1]) {
					hasType[inheritor.types[1]] = true;
				}
				movePool = template.randomBattleMoves?.slice() || Object.keys(this.dex.getLearnsetData(template.id).learnset || {});
				if (inheritor.randomBattleMoves) {
					let learnset = Object.keys(this.dex.getLearnsetData(toID(template.baseSpecies)).learnset || {});
					if (template.baseSpecies === 'Smeargle') {
						learnset = inheritor.randomBattleMoves.filter(moveid => moveid !== 'chatter');
					} else if (this.dex.getLearnsetData(template.id).learnset) {
						learnset = learnset.concat(Object.keys(this.dex.getLearnsetData(template.id).learnset || {}));
						if (template.name.substr(0, 6) === 'Rotom-' || template.name.substr(0, 9) === 'Necrozma-') {
							learnset = learnset.concat(Object.keys(this.dex.getLearnsetData(toID(template.baseSpecies)).learnset || {}));
						}
					}
					for (const move of inheritor.randomBattleMoves || []) {
						if (!movePool.includes(move) && learnset.includes(move)) movePool.push(move);
					}
				}
			} while (!this.queryMoves(movePool, hasType, hasAbility).stab);
			samples.pop();
			pokemonPool = pokemonPool.concat(samples);
			if (!sample) continue;

			// Useless in Random Battle without greatly lowering the levels of everything else
			if (inheritor!.name === 'Unown') continue;

			// Only certain NFE Pokemon are allowed
			if (inheritor!.evos.length && !allowedNFE.includes(inheritor!.name)) continue;

			let tier: string = inheritor!.tier;
			if (inheritor!.name === 'Slaking' || inheritor!.name === 'Regigigas') tier = 'Uber';
			switch (tier) {
			case 'Uber':
				// Ubers are limited to 2 but have a 20% chance of being added anyway.
				if (uberCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'PU':
				// PUs are limited to 2 but have a 20% chance of being added anyway.
				if (puCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'Unreleased':
				// Unreleased Pokémon have 20% the normal rate
				if (this.random(5) >= 1) continue;
				break;
			case 'CAP':
				// CAPs have 20% the normal rate
				if (this.random(5) >= 1) continue;
			}

			// Limit 2 of any type
			const types = inheritor!.types;
			let skip = false;
			for (const type of types) {
				if (typeCount[type] > 1 && this.random(5) >= 1) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			if (potd?.exists) {
				// The Pokemon of the Day belongs in slot 2
				if (pokemon.length === 1) {
					inheritor = potd;
				} else if (inheritor!.name === potd.name) {
					continue; // No, thanks, I've already got one
				}
			}

			if (inheritor!.otherFormes) {
				const battleForme = this.dex.getSpecies(inheritor!.otherFormes[0]);
				if (battleForme.isPrimal || (battleForme.isMega || !teamDetails.megaStone)) inheritor = battleForme;
			}
			const mixedTemplate = this.dex.deepClone(inheritor!);
			mixedTemplate.randomBattleMoves = movePool;
			mixedTemplate.abilities = template.abilities;
			mixedTemplate.inheritedItem = template.requiredItems && template.requiredItems[0];
			mixedTemplate.requiredMove = null;
			mixedTemplate.otherFormes = null;
			const set = this.randomSet(mixedTemplate, teamDetails, !pokemon.length);

			// Illusion shouldn't be the last Pokemon of the team
			if (set.ability === 'Illusion' && pokemon.length > 4) continue;

			// Limit 1 of any type combination
			let typeCombo = types.slice().sort().join();
			if (set.ability === 'Drought' || set.ability === 'Drizzle' || set.ability === 'Sand Stream') {
				// Drought, Drizzle and Sand Stream don't count towards the type combo limit
				typeCombo = set.ability;
			}
			if (typeCombo in typeComboCount) continue;

			// Okay, the set passes, add it to our team
			set.donorTemplate = template.id;
			pokemon.push(set);

			// Now that our Pokemon has passed all checks, we can increment our counters
			baseFormes[template.baseSpecies] = 1;

			// Increment type counters
			for (const type of types) {
				if (type in typeCount) {
					typeCount[type]++;
				} else {
					typeCount[type] = 1;
				}
			}
			typeComboCount[typeCombo] = 1;

			// Increment Uber/NU counters
			if (tier === 'Uber') {
				uberCount++;
			} else if (tier === 'PU') {
				puCount++;
			}

			// Team has Mega/weather/hazards
			if (this.dex.getItem(set.item).megaStone) teamDetails['megaStone'] = 1;
			if (set.ability === 'Snow Warning') teamDetails['hail'] = 1;
			if (set.ability === 'Drizzle' || set.moves.includes('raindance')) teamDetails['rain'] = 1;
			if (set.ability === 'Sand Stream') teamDetails['sand'] = 1;
			if (set.moves.includes('stealthrock')) teamDetails['stealthRock'] = 1;
			if (set.moves.includes('toxicspikes')) teamDetails['toxicSpikes'] = 1;
			if (set.moves.includes('defog')) teamDetails['defog'] = 1;
			if (set.moves.includes('rapidspin')) teamDetails['rapidSpin'] = 1;
		}
		return pokemon;
	}

	randomNoMegaTeam() {
		const pokemon = [];

		const excludedTiers = ['NFE', 'LC Uber', 'LC'];
		const allowedNFE = ['Chansey', 'Doublade', 'Gligar', 'Porygon2', 'Scyther', 'Togetic'];

		const availableFormes: {[k: string]: string[]} = {};
		for (const id in this.dex.data.FormatsData) {
			const template = this.dex.getSpecies(id);
			if (!excludedTiers.includes(template.tier) && !template.requiredItem && !template.isMega && !template.isPrimal && !template.isNonstandard && template.randomBattleMoves) {
				if (!availableFormes[template.baseSpecies]) {
					availableFormes[template.baseSpecies] = [id];
				} else {
					availableFormes[template.baseSpecies].push(id);
				}
			}
		}
		const pokemonPool = Object.values(availableFormes);

		// PotD stuff
		let potd;
		if (global.Config && Config.potd && this.dex.getRuleTable(this.format).has('potd')) {
			potd = this.dex.getSpecies(Config.potd);
		}

		const typeCount: {[k: string]: number} = {};
		const typeComboCount: {[k: string]: number} = {};
		const baseFormes: {[k: string]: number} = {};
		let uberCount = 0;
		let puCount = 0;
		const teamDetails: RandomTeamsTypes.TeamDetails = {};

		while (pokemonPool.length && pokemon.length < 6) {
			let template = this.dex.getSpecies(this.sample(this.sampleNoReplace(pokemonPool)));
			if (!template.exists) continue;

			// Useless in Random Battle without greatly lowering the levels of everything else
			if (template.name === 'Unown') continue;

			// Only certain NFE Pokemon are allowed
			if (template.evos.length && !allowedNFE.includes(template.name)) continue;

			const tier = template.tier;
			switch (tier) {
			case 'Uber':
				// Ubers are limited to 2 but have a 20% chance of being added anyway.
				if (uberCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'PU':
				// PUs are limited to 2 but have a 20% chance of being added anyway.
				if (puCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'Unreleased':
				// Unreleased Pokémon have 20% the normal rate
				if (this.random(5) >= 1) continue;
				break;
			case 'CAP':
				// CAPs have 20% the normal rate
				if (this.random(5) >= 1) continue;
			}

			// Limit 2 of any type
			const types = template.types;
			let skip = false;
			for (const type of types) {
				if (typeCount[type] > 1 && this.random(5) >= 1) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			if (potd?.exists) {
				// The Pokemon of the Day belongs in slot 2
				if (pokemon.length === 1) {
					template = potd;
					if (template.name === 'Magikarp') {
						template = Object.assign({}, potd, {randomBattleMoves: ['bounce', 'flail', 'splash', 'magikarpsrevenge']});
					} else if (template.name === 'Delibird') {
						template = Object.assign({}, potd, {randomBattleMoves: ['present', 'bestow']});
					}
				} else if (template.name === potd.name) {
					continue; // No, thanks, I've already got one
				}
			}

			const set = this.randomSet(template, teamDetails, !pokemon.length);

			// Illusion shouldn't be the last Pokemon of the team
			if (set.ability === 'Illusion' && pokemon.length > 4) continue;

			// Limit 1 of any type combination
			let typeCombo = types.slice().sort().join();
			if (set.ability === 'Drought' || set.ability === 'Drizzle' || set.ability === 'Sand Stream') {
				// Drought, Drizzle and Sand Stream don't count towards the type combo limit
				typeCombo = set.ability;
			}
			if (typeCombo in typeComboCount) continue;

			if (template.cosmeticFormes) set.species = template.cosmeticFormes[this.random(template.cosmeticFormes.length)];

			// Okay, the set passes, add it to our team
			pokemon.push(set);

			// Now that our Pokemon has passed all checks, we can increment our counters
			baseFormes[template.baseSpecies] = 1;

			// Increment type counters
			for (const type of types) {
				if (type in typeCount) {
					typeCount[type]++;
				} else {
					typeCount[type] = 1;
				}
			}
			typeComboCount[typeCombo] = 1;

			// Increment Uber/NU counters
			if (tier === 'Uber') {
				uberCount++;
			} else if (tier === 'PU') {
				puCount++;
			}

			// Team has Mega/weather/hazards
			if (this.dex.getItem(set.item).megaStone) teamDetails['megaStone'] = 1;
			if (set.ability === 'Snow Warning') teamDetails['hail'] = 1;
			if (set.ability === 'Drizzle' || set.moves.includes('raindance')) teamDetails['rain'] = 1;
			if (set.ability === 'Sand Stream') teamDetails['sand'] = 1;
			if (set.moves.includes('stealthrock')) teamDetails['stealthRock'] = 1;
			if (set.moves.includes('toxicspikes')) teamDetails['toxicSpikes'] = 1;
			if (set.moves.includes('defog')) teamDetails['defog'] = 1;
			if (set.moves.includes('rapidspin')) teamDetails['rapidSpin'] = 1;
		}
		return pokemon;
	}

	randomTeam() {
		const seed = this.prng.seed;
		const ruleTable = this.dex.getRuleTable(this.format);
		const pokemon = [];

		const allowedNFE = ['Chansey', 'Doublade', 'Gligar', 'Pikachu', 'Porygon2', 'Scyther', 'Type: Null'];

		// For Monotype
		const isMonotype: string | false = ruleTable.has('sametypeclause') && this.sample(Object.keys(this.dex.data.TypeChart));

		const availableFormes: {[k: string]: string[]} = {};
		for (const id in this.dex.data.FormatsData) {
			const template = this.dex.getSpecies(id);
			if (isMonotype) {
				let types = template.types;
				if (template.battleOnly) types = this.dex.getSpecies(template.baseSpecies).types;
				if (!types.includes(isMonotype)) continue;
			}
			if (this.format.id.endsWith("benjaminbutterfree") && !template.prevo) continue;
			if (template.gen <= this.gen && (!template.nfe || allowedNFE.includes(template.name)) && !template.isMega && !template.isPrimal && !template.isNonstandard && template.randomBattleMoves) {
				if (!availableFormes[template.baseSpecies]) {
					availableFormes[template.baseSpecies] = [id];
				} else {
					availableFormes[template.baseSpecies].push(id);
				}
			}
		}
		const pokemonPool = Object.values(availableFormes);

		// PotD stuff
		let potd;
		if (global.Config && Config.potd && ruleTable.has('potd')) {
			potd = this.dex.getSpecies(Config.potd);
		}

		const baseFormes: {[k: string]: number} = {};
		const tierCount: {[k: string]: number} = {};
		const typeCount: {[k: string]: number} = {};
		const typeComboCount: {[k: string]: number} = {};
		const teamDetails: RandomTeamsTypes.TeamDetails = {};

		while (pokemonPool.length && pokemon.length < 6) {
			let template = this.dex.getSpecies(this.sample(this.sampleNoReplace(pokemonPool)));
			if (!template.exists) continue;

			const tier = template.tier;

			// Limit two Pokemon per tier
			if (tierCount[tier] > 1) {
				continue;
			}

			const types = template.types;

			if (!isMonotype) {
				// Limit two of any type
				let skip = false;
				for (const type of types) {
					if (typeCount[type] > 1 && this.randomChance(4, 5)) {
						skip = true;
						break;
					}
				}
				if (skip) continue;
			}

			if (potd?.exists) {
				// The Pokemon of the Day belongs in slot 4
				if (pokemon.length === 3) {
					template = potd;
				} else if (template.name === potd.name) {
					continue; // No thanks, I've already got it
				}
			}

			const set = this.randomSet(template, teamDetails, !pokemon.length, this.format.gameType !== 'singles');

			// Limit 1 of any type combination, 2 in Monotype
			let typeCombo = types.slice().sort().join();
			if (set.ability === 'Drought' || set.ability === 'Drizzle' || set.ability === 'Sand Stream') {
				// Drought, Drizzle and Sand Stream don't count towards the type combo limit
				typeCombo = set.ability;
				if (typeCombo in typeComboCount) continue;
			} else {
				if (typeComboCount[typeCombo] >= (isMonotype ? 2 : 1)) continue;
			}

			const item = this.dex.getItem(set.item);

			// Limit 1 Z-Move per team
			if (item.zMove && teamDetails['zMove']) continue;

			// Zoroark copies the last Pokemon
			if (set.ability === 'Illusion') {
				if (pokemon.length < 1) continue;
				set.level = pokemon[pokemon.length - 1].level;
			}

			if (template.cosmeticFormes) set.species = template.cosmeticFormes[this.random(template.cosmeticFormes.length)];

			// Okay, the set passes, add it to our team
			pokemon.unshift(set);

			// Don't bother tracking details for the 6th Pokemon
			if (pokemon.length === 6) break;

			// Now that our Pokemon has passed all checks, we can increment our counters
			baseFormes[template.baseSpecies] = 1;

			// Tier counter.
			if (tierCount[tier]) {
				tierCount[tier]++;
			} else {
				tierCount[tier] = 1;
			}

			// Increment type counters
			for (const type of types) {
				if (type in typeCount) {
					typeCount[type]++;
				} else {
					typeCount[type] = 1;
				}
			}
			if (typeCombo in typeComboCount) {
				typeComboCount[typeCombo]++;
			} else {
				typeComboCount[typeCombo] = 1;
			}

			// Team has Mega/weather/hazards
			if (item.megaStone) teamDetails['megaStone'] = 1;
			if (item.zMove) teamDetails['zMove'] = 1;
			if (set.ability === 'Snow Warning' || set.moves.includes('hail')) teamDetails['hail'] = 1;
			if (set.moves.includes('raindance') || set.ability === 'Drizzle' && !item.onPrimal) teamDetails['rain'] = 1;
			if (set.ability === 'Sand Stream') teamDetails['sand'] = 1;
			if (set.moves.includes('sunnyday') || set.ability === 'Drought' && !item.onPrimal) teamDetails['sun'] = 1;
			if (set.moves.includes('stealthrock')) teamDetails['stealthRock'] = 1;
			if (set.moves.includes('toxicspikes')) teamDetails['toxicSpikes'] = 1;
			if (set.moves.includes('stickyweb')) teamDetails['stickyWeb'] = 1;
			if (set.moves.includes('defog')) teamDetails['defog'] = 1;
			if (set.moves.includes('rapidspin')) teamDetails['rapidSpin'] = 1;
		}
		if (pokemon.length < 6) throw new Error(`Could not build a random team for ${this.format} (seed=${seed})`);
		return pokemon;
	}

	randomFactorySet(
		species: Species, teamData: RandomTeamsTypes.FactoryTeamDetails, tier: string
	): RandomTeamsTypes.RandomFactorySet | null {
		const id = toID(species.name);
		// const flags = this.randomFactorySets[tier][id].flags;
		const factorySets = this.format.factoryTier ? this.randomOMFactorySets : this.randomFactorySets;
		const mnm = this.format.id === 'gen7mixandmegafactory';
		const setList = factorySets[tier][id].sets;

		const itemsMax: {[k: string]: number} = {
			choicespecs: 1,
			choiceband: 1,
			choicescarf: 1,
		};
		const movesMax: {[k: string]: number} = {
			rapidspin: 1,
			batonpass: 1,
			stealthrock: 1,
			defog: 1,
			spikes: 1,
			toxicspikes: 1,
		};
		const requiredMoves: {[k: string]: string} = {
			stealthrock: 'hazardSet',
			rapidspin: 'hazardClear',
			defog: 'hazardClear',
		};
		const weatherAbilitiesRequire: {[k: string]: string} = {
			hydration: 'raindance', swiftswim: 'raindance',
			leafguard: 'sunnyday', solarpower: 'sunnyday', chlorophyll: 'sunnyday',
			sandforce: 'sandstorm', sandrush: 'sandstorm', sandveil: 'sandstorm',
			slushrush: 'hail', snowcloak: 'hail',
		};
		const weatherAbilities = ['drizzle', 'drought', 'snowwarning', 'sandstream'];

		// Build a pool of eligible sets, given the team partners
		// Also keep track of sets with moves the team requires
		let effectivePool: {set: AnyObject, moveVariants?: number[]}[] = [];
		const priorityPool = [];
		for (const curSet of setList) {
			const item = this.dex.getItem(curSet.item);
			if (!mnm && teamData.megaCount > 0 && item.megaStone) continue; // reject 2+ mega stones
			if (teamData.zCount && teamData.zCount > 0 && item.zMove) continue; // reject 2+ Z stones
			if (itemsMax[item.id] && teamData.has[item.id] >= itemsMax[item.id]) continue;

			const ability = this.dex.getAbility(curSet.ability);
			if (weatherAbilitiesRequire[ability.id] && teamData.weather !== weatherAbilitiesRequire[ability.id]) continue;
			if (teamData.weather && weatherAbilities.includes(ability.id)) continue; // reject 2+ weather setters

			let reject = false;
			let hasRequiredMove = false;
			const curSetVariants = [];
			for (const move of curSet.moves) {
				const variantIndex = this.random(move.length);
				const moveId = toID(move[variantIndex]);
				if (movesMax[moveId] && teamData.has[moveId] >= movesMax[moveId]) {
					reject = true;
					break;
				}
				if (requiredMoves[moveId] && !teamData.has[requiredMoves[moveId]]) {
					hasRequiredMove = true;
				}
				curSetVariants.push(variantIndex);
			}
			if (reject) continue;
			effectivePool.push({set: curSet, moveVariants: curSetVariants});
			if (hasRequiredMove) priorityPool.push({set: curSet, moveVariants: curSetVariants});
		}
		if (priorityPool.length) effectivePool = priorityPool;

		if (!effectivePool.length) {
			if (!teamData.forceResult) return null;
			for (const curSet of setList) {
				effectivePool.push({set: curSet});
			}
		}

		const setData = this.sample(effectivePool);
		const moves = [];
		for (const [i, moveSlot] of setData.set.moves.entries()) {
			moves.push(setData.moveVariants ? moveSlot[setData.moveVariants[i]] : this.sample(moveSlot));
		}

		const item = Array.isArray(setData.set.item) ? this.sample(setData.set.item) : setData.set.item;
		const ability = Array.isArray(setData.set.ability) ? this.sample(setData.set.ability) : setData.set.ability;
		const nature = Array.isArray(setData.set.nature) ? this.sample(setData.set.nature) : setData.set.nature;

		return {
			name: setData.set.name || species.baseSpecies,
			species: setData.set.species,
			gender: setData.set.gender || species.gender || (this.randomChance(1, 2) ? 'M' : 'F'),
			item: item || '',
			ability: ability || species.abilities['0'],
			shiny: typeof setData.set.shiny === 'undefined' ? this.randomChance(1, 1024) : setData.set.shiny,
			level: setData.set.level ? setData.set.level : tier === "LC" ? 5 : 100,
			happiness: typeof setData.set.happiness === 'undefined' ? 255 : setData.set.happiness,
			evs: Object.assign({hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}, setData.set.evs),
			ivs: Object.assign({hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}, setData.set.ivs),
			nature: nature || 'Serious',
			moves: moves,
		};
	}

	randomFactoryTeam(side: PlayerOptions, depth = 0): RandomTeamsTypes.RandomFactorySet[] {
		const forceResult = (depth >= 4);

		// The teams generated depend on the tier choice in such a way that
		// no exploitable information is leaked from rolling the tier in getTeam(p1).
		const availableTiers = ['Uber', 'OU', 'UU', 'RU', 'NU', 'PU', 'LC', 'Mono'];
		if (!this.factoryTier) this.factoryTier = this.format.factoryTier || this.sample(availableTiers);
		const chosenTier = this.factoryTier;

		const tierValues: {[k: string]: number} = {
			Uber: 5,
			OU: 4, UUBL: 4,
			UU: 3, RUBL: 3,
			RU: 2, NUBL: 2,
			NU: 1, PUBL: 1,
			PU: 0,
		};

		const pokemon = [];
		const factorySets = this.format.factoryTier ? this.randomOMFactorySets : this.randomFactorySets;
		const mnm = this.format.id === 'gen7mixandmegafactory';
		const pokemonPool = Object.keys(factorySets[chosenTier]);

		const typePool = Object.keys(this.dex.data.TypeChart);
		const type = this.sample(typePool);

		const teamData: TeamData = {
			typeCount: {}, typeComboCount: {}, baseFormes: {}, megaCount: 0, zCount: 0,
			has: {}, forceResult: forceResult, weaknesses: {}, resistances: {},
		};
		const requiredMoveFamilies = ['hazardSet', 'hazardClear'];
		const requiredMoves: {[k: string]: string} = {
			stealthrock: 'hazardSet',
			rapidspin: 'hazardClear',
			defog: 'hazardClear',
		};
		const weatherAbilitiesSet: {[k: string]: string} = {
			drizzle: 'raindance',
			drought: 'sunnyday',
			snowwarning: 'hail',
			sandstream: 'sandstorm',
		};
		const resistanceAbilities: {[k: string]: string[]} = {
			dryskin: ['Water'], waterabsorb: ['Water'], stormdrain: ['Water'],
			flashfire: ['Fire'], heatproof: ['Fire'],
			lightningrod: ['Electric'], motordrive: ['Electric'], voltabsorb: ['Electric'],
			sapsipper: ['Grass'],
			thickfat: ['Ice', 'Fire'],
			levitate: ['Ground'],
		};

		while (pokemonPool.length && pokemon.length < 6) {
			const species = this.dex.getSpecies(this.sampleNoReplace(pokemonPool));
			if (!species.exists) continue;

			// Lessen the need of deleting sets of Pokemon after tier shifts
			if (
				chosenTier in tierValues && species.tier in tierValues &&
				tierValues[species.tier] > tierValues[chosenTier]
			) continue;

			const speciesFlags = factorySets[chosenTier][species.id].flags;

			// Limit to one of each species (Species Clause)
			if (teamData.baseFormes[species.baseSpecies]) continue;

			// Limit the number of Megas to one
			if (!mnm && teamData.megaCount >= 1 && speciesFlags.megaOnly) continue;

			const set = this.randomFactorySet(species, teamData, chosenTier);
			if (!set) continue;

			const itemData = this.dex.getItem(set.item);

			// Actually limit the number of Megas to one
			if (!mnm && teamData.megaCount >= 1 && itemData.megaStone) continue;

			// Limit the number of Z moves to one
			if (teamData.zCount && teamData.zCount >= 1 && itemData.zMove) continue;

			// Mega stone clause, sort of
			if (mnm && teamData.has[itemData.id]) continue;

			let types = species.types;

			// Enforce Monotype
			if (chosenTier === 'Mono') {
				// Prevents Mega Evolutions from breaking the type limits
				if (itemData.megaStone) {
					const megaSpecies = this.dex.getSpecies(itemData.megaStone);
					if (types.length > megaSpecies.types.length) types = [species.types[0]];
					// Only check the second type because a Mega Evolution should always share the first type with its base forme.
					if (megaSpecies.types[1] && types[1] && megaSpecies.types[1] !== types[1]) {
						types = [megaSpecies.types[0]];
					}
				}
				if (!types.includes(type)) continue;
			} else {
				// If not Monotype, limit to two of each type
				let skip = false;
				for (const typeName of types) {
					if (teamData.typeCount[typeName] > 1 && this.randomChance(4, 5)) {
						skip = true;
						break;
					}
				}
				if (skip) continue;

				// Limit 1 of any type combination
				let typeCombo = types.slice().sort().join();
				if (set.ability + '' === 'Drought' || set.ability + '' === 'Drizzle') {
				// Drought and Drizzle don't count towards the type combo limit
					typeCombo = set.ability + '';
				}
				if (typeCombo in teamData.typeComboCount) continue;
			}

			if (species.cosmeticFormes) set.species = species.cosmeticFormes[this.random(species.cosmeticFormes.length)];

			// Okay, the set passes, add it to our team
			pokemon.push(set);
			const typeCombo = types.slice().sort().join();
			// Now that our Pokemon has passed all checks, we can update team data:
			for (const typeName of types) {
				if (typeName in teamData.typeCount) {
					teamData.typeCount[typeName]++;
				} else {
					teamData.typeCount[typeName] = 1;
				}
			}
			teamData.typeComboCount[typeCombo] = 1;

			teamData.baseFormes[species.baseSpecies] = 1;

			if (itemData.megaStone) teamData.megaCount++;
			if (itemData.zMove) {
				if (!teamData.zCount) teamData.zCount = 0;
				teamData.zCount++;
			}
			if (itemData.id in teamData.has) {
				teamData.has[itemData.id]++;
			} else {
				teamData.has[itemData.id] = 1;
			}

			const abilityData = this.dex.getAbility(set.ability);
			if (abilityData.id in weatherAbilitiesSet) {
				teamData.weather = weatherAbilitiesSet[abilityData.id];
			}

			for (const move of set.moves) {
				const moveId = toID(move);
				if (moveId in teamData.has) {
					teamData.has[moveId]++;
				} else {
					teamData.has[moveId] = 1;
				}
				if (moveId in requiredMoves) {
					teamData.has[requiredMoves[moveId]] = 1;
				}
			}

			for (const typeName in this.dex.data.TypeChart) {
				// Cover any major weakness (3+) with at least one resistance
				if (teamData.resistances[typeName] >= 1) continue;
				if (
					resistanceAbilities[abilityData.id] && resistanceAbilities[abilityData.id].includes(typeName) ||
					!this.dex.getImmunity(typeName, types)
				) {
					// Heuristic: assume that Pokémon with these abilities don't have (too) negative typing.
					teamData.resistances[typeName] = (teamData.resistances[typeName] || 0) + 1;
					if (teamData.resistances[typeName] >= 1) teamData.weaknesses[typeName] = 0;
					continue;
				}
				const typeMod = this.dex.getEffectiveness(typeName, types);
				if (typeMod < 0) {
					teamData.resistances[typeName] = (teamData.resistances[typeName] || 0) + 1;
					if (teamData.resistances[typeName] >= 1) teamData.weaknesses[typeName] = 0;
				} else if (typeMod > 0) {
					teamData.weaknesses[typeName] = (teamData.weaknesses[typeName] || 0) + 1;
				}
			}
		}
		if (pokemon.length < 6) return this.randomFactoryTeam(side, ++depth);

		// Quality control
		if (!teamData.forceResult) {
			for (const requiredFamily of requiredMoveFamilies) {
				if (!teamData.has[requiredFamily]) return this.randomFactoryTeam(side, ++depth);
			}
			for (const typeName in teamData.weaknesses) {
				if (teamData.weaknesses[typeName] >= 3) return this.randomFactoryTeam(side, ++depth);
			}
		}

		return pokemon;
	}

	randomBSSFactorySet(
		species: Species, teamData: RandomTeamsTypes.FactoryTeamDetails
	): RandomTeamsTypes.RandomFactorySet | null {
		const id = toID(species.name);
		// const flags = this.randomBSSFactorySets[tier][id].flags;
		const setList = this.randomBSSFactorySets[id].sets;

		const movesMax: {[k: string]: number} = {
			batonpass: 1,
			stealthrock: 1,
			spikes: 1,
			toxicspikes: 1,
			doubleedge: 1,
			trickroom: 1,
		};
		const requiredMoves: {[k: string]: number} = {};
		const weatherAbilitiesRequire: {[k: string]: string} = {
			swiftswim: 'raindance',
			sandrush: 'sandstorm', sandveil: 'sandstorm',
		};
		const weatherAbilities = ['drizzle', 'drought', 'snowwarning', 'sandstream'];

		// Build a pool of eligible sets, given the team partners
		// Also keep track of sets with moves the team requires
		let effectivePool: {set: AnyObject, moveVariants?: number[], itemVariants?: number, abilityVariants?: number}[] = [];
		const priorityPool = [];
		for (const curSet of setList) {
			const item = this.dex.getItem(curSet.item);
			if (teamData.megaCount > 1 && item.megaStone) continue; // reject 3+ mega stones
			if (teamData.zCount && teamData.zCount > 1 && item.zMove) continue; // reject 3+ Z stones
			if (teamData.has[item.id]) continue; // Item clause

			const ability = this.dex.getAbility(curSet.ability);
			if (weatherAbilitiesRequire[ability.id] && teamData.weather !== weatherAbilitiesRequire[ability.id]) continue;
			if (teamData.weather && weatherAbilities.includes(ability.id)) continue; // reject 2+ weather setters

			if (curSet.species === 'Aron' && teamData.weather !== 'sandstorm') continue; // reject Aron without a Sand Stream user

			let reject = false;
			let hasRequiredMove = false;
			const curSetVariants = [];
			for (const move of curSet.moves) {
				const variantIndex = this.random(move.length);
				const moveId = toID(move[variantIndex]);
				if (movesMax[moveId] && teamData.has[moveId] >= movesMax[moveId]) {
					reject = true;
					break;
				}
				if (requiredMoves[moveId] && !teamData.has[requiredMoves[moveId]]) {
					hasRequiredMove = true;
				}
				curSetVariants.push(variantIndex);
			}
			if (reject) continue;
			effectivePool.push({set: curSet, moveVariants: curSetVariants});
			if (hasRequiredMove) priorityPool.push({set: curSet, moveVariants: curSetVariants});
		}
		if (priorityPool.length) effectivePool = priorityPool;

		if (!effectivePool.length) {
			if (!teamData.forceResult) return null;
			for (const curSet of setList) {
				effectivePool.push({set: curSet});
			}
		}

		const setData = this.sample(effectivePool);
		const moves = [];
		for (const [i, moveSlot] of setData.set.moves.entries()) {
			moves.push(setData.moveVariants ? moveSlot[setData.moveVariants[i]] : this.sample(moveSlot));
		}

		return {
			name: setData.set.nickname || setData.set.name || species.baseSpecies,
			species: setData.set.species,
			gender: setData.set.gender || species.gender || (this.randomChance(1, 2) ? 'M' : 'F'),
			item: setData.set.item || '',
			ability: setData.set.ability || species.abilities['0'],
			shiny: typeof setData.set.shiny === 'undefined' ? this.randomChance(1, 1024) : setData.set.shiny,
			level: setData.set.level || 50,
			happiness: typeof setData.set.happiness === 'undefined' ? 255 : setData.set.happiness,
			evs: Object.assign({hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}, setData.set.evs),
			ivs: Object.assign({hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}, setData.set.ivs),
			nature: setData.set.nature || 'Serious',
			moves: moves,
		};
	}

	randomBSSFactoryTeam(side: PlayerOptions, depth = 0): RandomTeamsTypes.RandomFactorySet[] {
		const forceResult = (depth >= 4);

		const pokemon = [];

		const pokemonPool = Object.keys(this.randomBSSFactorySets);

		const teamData: TeamData = {
			typeCount: {}, typeComboCount: {}, baseFormes: {}, megaCount: 0, zCount: 0,
			eeveeLimCount: 0, has: {}, forceResult: forceResult, weaknesses: {}, resistances: {},
		};
		const requiredMoveFamilies: string[] = [];
		const requiredMoves: {[k: string]: string} = {};
		const weatherAbilitiesSet: {[k: string]: string} = {
			drizzle: 'raindance',
			drought: 'sunnyday',
			snowwarning: 'hail',
			sandstream: 'sandstorm',
		};
		const resistanceAbilities: {[k: string]: string[]} = {
			waterabsorb: ['Water'],
			flashfire: ['Fire'],
			lightningrod: ['Electric'], voltabsorb: ['Electric'],
			thickfat: ['Ice', 'Fire'],
			levitate: ['Ground'],
		};

		while (pokemonPool.length && pokemon.length < 6) {
			const species = this.dex.getSpecies(this.sampleNoReplace(pokemonPool));
			if (!species.exists) continue;

			const speciesFlags = this.randomBSSFactorySets[species.id].flags;

			// Limit to one of each species (Species Clause)
			if (teamData.baseFormes[species.baseSpecies]) continue;

			// Limit the number of Megas + Z-moves to 3
			if (teamData.megaCount + (teamData.zCount ? teamData.zCount : 0) >= 3 && speciesFlags.megaOnly) continue;

			// Limit 2 of any type
			const types = species.types;
			let skip = false;
			for (const type of types) {
				if (teamData.typeCount[type] > 1 && this.randomChance(4, 5)) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			// Restrict Eevee with certain Pokemon
			if (speciesFlags.limEevee) {
				if (!teamData.eeveeLimCount) teamData.eeveeLimCount = 0;
				teamData.eeveeLimCount++;
			}
			if (teamData.eeveeLimCount && teamData.eeveeLimCount >= 1 && speciesFlags.limEevee) continue;

			const set = this.randomBSSFactorySet(species, teamData);
			if (!set) continue;

			// Limit 1 of any type combination
			let typeCombo = types.slice().sort().join();
			if (set.ability === 'Drought' || set.ability === 'Drizzle') {
				// Drought and Drizzle don't count towards the type combo limit
				typeCombo = set.ability;
			}
			if (typeCombo in teamData.typeComboCount) continue;

			// Okay, the set passes, add it to our team
			pokemon.push(set);

			// Now that our Pokemon has passed all checks, we can update team data:
			for (const type of types) {
				if (type in teamData.typeCount) {
					teamData.typeCount[type]++;
				} else {
					teamData.typeCount[type] = 1;
				}
			}
			teamData.typeComboCount[typeCombo] = 1;

			teamData.baseFormes[species.baseSpecies] = 1;

			// Limit Mega and Z-move
			const itemData = this.dex.getItem(set.item);
			if (itemData.megaStone) teamData.megaCount++;
			if (itemData.zMove) {
				if (!teamData.zCount) teamData.zCount = 0;
				teamData.zCount++;
			}
			// Limit to one of each item
			teamData.has[itemData.id] = 1;

			const abilityData = this.dex.getAbility(set.ability);
			if (abilityData.id in weatherAbilitiesSet) {
				teamData.weather = weatherAbilitiesSet[abilityData.id];
			}

			for (const move of set.moves) {
				const moveId = toID(move);
				if (moveId in teamData.has) {
					teamData.has[moveId]++;
				} else {
					teamData.has[moveId] = 1;
				}
				if (moveId in requiredMoves) {
					teamData.has[requiredMoves[moveId]] = 1;
				}
			}

			for (const typeName in this.dex.data.TypeChart) {
				// Cover any major weakness (3+) with at least one resistance
				if (teamData.resistances[typeName] >= 1) continue;
				if (
					resistanceAbilities[abilityData.id] && resistanceAbilities[abilityData.id].includes(typeName) ||
					!this.dex.getImmunity(typeName, types)
				) {
					// Heuristic: assume that Pokémon with these abilities don't have (too) negative typing.
					teamData.resistances[typeName] = (teamData.resistances[typeName] || 0) + 1;
					if (teamData.resistances[typeName] >= 1) teamData.weaknesses[typeName] = 0;
					continue;
				}
				const typeMod = this.dex.getEffectiveness(typeName, types);
				if (typeMod < 0) {
					teamData.resistances[typeName] = (teamData.resistances[typeName] || 0) + 1;
					if (teamData.resistances[typeName] >= 1) teamData.weaknesses[typeName] = 0;
				} else if (typeMod > 0) {
					teamData.weaknesses[typeName] = (teamData.weaknesses[typeName] || 0) + 1;
				}
			}
		}
		if (pokemon.length < 6) return this.randomBSSFactoryTeam(side, ++depth);

		// Quality control
		if (!teamData.forceResult) {
			for (const requiredFamily of requiredMoveFamilies) {
				if (!teamData.has[requiredFamily]) return this.randomBSSFactoryTeam(side, ++depth);
			}
			for (const type in teamData.weaknesses) {
				if (teamData.weaknesses[type] >= 3) return this.randomBSSFactoryTeam(side, ++depth);
			}
		}

		return pokemon;
	}

	randomSeasonalFireworksTeam() {
		const seasonalPokemonList = [
			"aerodactyl", "altaria", "archeops", "articuno", "azelf", "beautifly", "braviary", "bronzong",
			"butterfree", "carnivine", "charizard", "chingling", "claydol", "cresselia", "crobat", "cryogonal",
			"dragonite", "drifblim", "eelektross", "emolga", "fearow", "flygon", "giratinaorigin", "gligar",
			"gliscor", "gyarados", "honchkrow", "hooh", "hydreigon", "jumpluff", "landorus", "landorustherian",
			"latias", "latios", "lugia", "lunatone", "mandibuzz", "mantine", "masquerain", "mesprit", "mismagius",
			"moltres", "mothim", "ninjask", "noctowl", "noivern", "pelipper", "pidgeot", "rayquaza", "rotom",
			"rotomfan", "rotomfrost", "rotomheat", "rotommow", "rotomwash", "salamence", "scyther", "sigilyph",
			"skarmory", "solrock", "staraptor", "swanna", "swellow", "swoobat", "talonflame", "thundurus",
			"thundurustherian", "togekiss", "tornadus", "tornadustherian", "tropius", "unfezant", "uxie",
			"vespiquen", "vivillon", "weezing", "xatu", "yanma", "yanmega", "yveltal", "zapdos",
		];

		const forbiddenMoves = [
			'bodyslam', 'bulldoze', 'dig', 'dive', 'earthpower', 'earthquake', 'electricterrain', 'fissure',
			'firepledge', 'flyingpress', 'frenzyplant', 'geomancy', 'grassknot', 'grasspledge', 'grassyterrain',
			'gravity', 'heatcrash', 'heavyslam', 'ingrain', 'landswrath', 'magnitude', 'matblock', 'mistyterrain',
			'mudsport', 'muddywater', 'rototiller', 'seismictoss', 'slam', 'smackdown', 'spikes', 'stomp',
			'substitute', 'surf', 'toxicspikes', 'thousandarrows', 'thousandwaves', 'waterpledge', 'watersport',
		];

		const team = [];
		const typeCount: {[k: string]: number} = {};
		const typeComboCount: {[k: string]: number} = {};
		const baseFormes: {[k: string]: number} = {};
		let uberCount = 0;
		let puCount = 0;
		const teamDetails: RandomTeamsTypes.TeamDetails = {};
		const multipleFormes: {[k: string]: number} = {
			'Landorus': 2,
			'Rotom': 6,
			'Thundurus': 2,
			'Tornadus': 2,
		};

		while (team.length < 6) {
			const pokemon = this.sampleNoReplace(seasonalPokemonList);
			const template = this.dex.deepClone(this.dex.getSpecies(pokemon));

			if (!template.randomBattleMoves) template.randomBattleMoves = template.learnset;
			template.randomBattleMoves = template.randomBattleMoves.filter((move: string) => !forbiddenMoves.includes(move));

			// Define sets for the Ground/Flying mons that don't have good Flying STAB
			if (template.id === 'gligar') {
				template.randomBattleMoves = ['stealthrock', 'roost', 'knockoff', ['uturn', 'toxic'][this.random(2)]];
			}
			if (template.id === 'gliscor') {
				template.randomBattleMoves = ['stealthrock', 'protect', 'knockoff', ['toxic', 'roost'][this.random(2)]];
			}
			if (template.id === 'landorus') {
				template.randomBattleMoves = ['sludgewave', 'knockoff', 'rockslide', ['focusblast', 'psychic'][this.random(2)]];
			}
			if (template.id === 'landorustherian') {
				template.randomBattleMoves = ['uturn', 'stealthrock', 'stoneedge', 'knockoff'];
			}

			const tier = template.tier;
			switch (tier) {
			case 'Uber':
				// Ubers are limited to 2 but have a 20% chance of being added anyway.
				if (uberCount > 1 && this.random(5) >= 1) continue;
				break;
			case 'PU':
				// PUs are limited to 2 but have a 20% chance of being added anyway.
				if (puCount > 1 && this.random(5) >= 1) continue;
				break;
			}

			// Adjust rate for species with multiple formes
			if (multipleFormes[template.baseSpecies] && !this.randomChance(1, multipleFormes[template.baseSpecies]--)) continue;

			const set = this.randomSet(template, {}, !team.length);

			const types = template.types;

			// Limit 2 of any type, except Flying because it's most common
			let skip = false;
			for (const type of types) {
				if (type !== 'Flying' && typeCount[type] > 1 && this.random(5) >= 1) {
					skip = true;
					break;
				}
			}
			if (skip) continue;

			// Limit 1 of any type combination
			const typeCombo = types.slice().sort().join();
			if (typeCombo in typeComboCount) continue;

			// Okay, the set passes, add it to our team
			team.push(set);

			// Now that our Pokemon has passed all checks, we can increment our counters
			baseFormes[template.baseSpecies] = 1;

			// Increment type counters
			for (const type of types) {
				if (type in typeCount) {
					typeCount[type]++;
				} else {
					typeCount[type] = 1;
				}
			}
			if (typeCombo in typeComboCount) {
				typeComboCount[typeCombo]++;
			} else {
				typeComboCount[typeCombo] = 1;
			}

			// Increment Uber/NU counters
			if (tier === 'Uber') {
				uberCount++;
			} else if (tier === 'PU') {
				puCount++;
			}

			// Team has Mega/weather/hazards
			if (this.dex.getItem(set.item).megaStone) teamDetails['megaStone'] = 1;
			if (set.ability === 'Snow Warning') teamDetails['hail'] = 1;
			if (set.ability === 'Drizzle' || set.moves.includes('raindance')) teamDetails['rain'] = 1;
			if (set.ability === 'Sand Stream') teamDetails['sand'] = 1;
			if (set.moves.includes('stealthrock')) teamDetails['stealthRock'] = 1;
			if (set.moves.includes('defog')) teamDetails['defog'] = 1;
			if (set.moves.includes('rapidspin')) teamDetails['rapidSpin'] = 1;
		}

		return team;
	}
}

export default RandomGen7Teams;
