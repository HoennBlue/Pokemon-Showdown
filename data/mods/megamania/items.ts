'use strict';

/**@type {{[k: string]: ModdedItemData}} */
exports.BattleItems = {
	"eviolite": {
		inherit: true,
		onTakeItem(item, pokemon) {
			return !pokemon.baseTemplate.nfe;
		},
		desc: "If holder's species can evolve, its Defense and Sp. Def are 1.5x. Otherwise, it gains a custom Mega Evolution depending on whether it is shiny.",
	},
};
