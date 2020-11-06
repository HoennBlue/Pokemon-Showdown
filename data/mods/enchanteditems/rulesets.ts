export const Formats: {[k: string]: ModdedFormatsData} = {
	abilityclause: {
		effectType: 'Rule',
		name: "Ability Clause",
		onBegin() {
			this.add('rule', 'Ability Clause: Limit two of each ability');
		},
		onValidateTeam(team, format) {
			const abilityTable: {[k: string]: number} = {};
			for (const set of team) {
				const ability = this.dex.getAbility(set.ability);
				if (!abilityTable[ability.id]) abilityTable[ability.id] = 0;
				if (++abilityTable[ability.id] > 2) {
					return ["You are limited to two of each ability by Ability Clause.", "(You have more than two of " + ability.name + " or " + this.dex.getItem(ability.item).name + ")"];
				}
				const itemid = toID(set.item);
				if (!itemid) continue;
				const item = this.dex.getItem(itemid);
				const abilityid = item.ability;
				if (!abilityid) continue;
				if (!abilityTable[abilityid]) abilityTable[abilityid] = 0;
				if (++abilityTable[abilityid] > 2) {
					return ["You are limited to two of each ability by Ability Clause.", "(You have more than two of " + this.dex.getAbility(abilityid).name + " or " + item.name + ")"];
				}
			}
		},
	},
	batonpassclause: {
		effectType: 'Banlist',
		name: 'Baton Pass Clause',
		onBegin() {
			this.add('rule', 'Baton Pass Clause: Limit one Baton Passer, can\'t pass Spe and other stats simultaneously');
		},
		onValidateTeam(team, format) {
			let BPcount = 0;
			for (const set of team) {
				if (set.moves.includes('Baton Pass')) {
					BPcount++;
				}
				if (BPcount > 1) {
					return [(set.name || set.species) + " has Baton Pass, but you are limited to one Baton Pass user by Baton Pass Clause."];
				}
			}
		},
		onValidateSet(set, format, setHas) {
			if (!('batonpass' in setHas)) return;

			// check if Speed is boosted
			let speedBoosted = false;
			for (const moveid of set.moves) {
				const move = this.dex.getMove(moveid);
				if (move.boosts?.spe && move.boosts.spe > 0) {
					speedBoosted = true;
					break;
				}
			}
			const boostsSpeed = ['flamecharge', 'geomancy', 'motordrive', 'rattled', 'speedboost', 'steadfast', 'weakarmor', 'cheriberry', 'duskball', 'friendball', 'skullfossil', 'weaknesspolicy'];
			if (!speedBoosted) {
				for (const moveid of boostsSpeed) {
					if (moveid in setHas) {
						speedBoosted = true;
						break;
					}
				}
			}
			if (!speedBoosted) return;

			// check if non-Speed boosted
			let nonSpeedBoosted = false;
			for (const moveid of set.moves) {
				const move = this.dex.getMove(moveid);
				if (move.boosts && (move.boosts.atk! > 0 || move.boosts.def! > 0 || move.boosts.spa! > 0 || move.boosts.spd! > 0)) {
					nonSpeedBoosted = true;
					break;
				}
			}
			const boostsNonSpeed = ['acupressure', 'curse', 'metalclaw', 'meteormash', 'poweruppunch', 'rage', 'rototiller', 'fellstinger', 'bellydrum', 'download', 'justified', 'moxie', 'sapsipper', 'defiant', 'angerpoint', 'diamondstorm', 'flowershield', 'skullbash', 'steelwing', 'stockpile', 'cottonguard', 'chargebeam', 'fierydance', 'geomancy', 'lightningrod', 'stormdrain', 'competitive', 'charge', 'habanberry', 'salacberry', 'whiteherb', 'rawstberry', 'ganlonberry', 'shucaberry', 'heavyball', 'damprock'];
			if (!nonSpeedBoosted) {
				for (const moveid of boostsNonSpeed) {
					if (moveid in setHas) {
						nonSpeedBoosted = true;
						break;
					}
				}
			}
			if (!nonSpeedBoosted) return;

			return [(set.name || set.species) + " can Baton Pass both Speed and a different stat, which is banned by Baton Pass Clause."];
		},
	},
	evasionabilitiesclause: {
		effectType: 'Banlist',
		name: 'Evasion Abilities Clause',
		banlist: ['Sand Veil', 'Snow Cloak', 'Persim Berry', 'Cover Fossil'],
		onBegin() {
			this.add('rule', 'Evasion Abilities Clause: Evasion abilities are banned');
		},
	},
	moodyclause: {
		effectType: 'Banlist',
		name: 'Moody Clause',
		banlist: ['Moody', 'Wave Incense'],
		onBegin() {
			this.add('rule', 'Moody Clause: Moody is banned');
		},
	},
};
