export const Formats: {[k: string]: ModdedFormatsData} = {
	ateclause: {
		effectType: 'Banlist',
		name: '-ate Clause',
		banlist: ['Aerilate ++ Pixilate ++ Refrigerate > 1'],
		onBegin() {
			this.add('rule', '-ate Clause: Limit one of Aerilate/Refrigerate/Pixilate');
		},
	},
};
