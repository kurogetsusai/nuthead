// prototype: Nutcracker ///////////////////////////////////////////////////////

var Nutcracker = function (application) {
	console.log('Nutcracker instance created');

	if (typeof application !== 'object' || application == null)
		throw Error('Nutcracker: constructor: application is required');

	// technical
	this.app = application;

	// data
	this.nutshells = [
		/* array of nutshells {
		 * 	owner: object
		 * 	parent: object
		 * 	timer: nut timer, which can be paused and resumed
		 * 	variables: {}, vars used in the script
		 * 	nut: pointer to Entity's nut object
		 * }
		 */
	];
	this.variables = new WeakMap(
		/* {
		 * 	[variable name]: [variable value],
		 * 	...
		 * }
		 */
	);
};

Nutcracker.prototype.load = function () {
	// get all nuts of all entities
	this.app.map.entities.forEach(entity => {
		entity.nuts.forEach(nut => {
			this.nutshells.push({
				owner: entity,
				parent: this,
				timer: undefined,
				variables: {},
				nut: nut
			});
			this.variables.set(entity, {});
		});
	});
	this.app.player.nuts.forEach(nut => {
		this.nutshells.push({
			owner: this.app.player,
			parent: this,
			timer: undefined,
			variables: {},
			nut: nut
		});
	});
	this.variables.set(this.app.player, {});

	// exec all auto nuts
	this.nutshells.forEach(nutshell => {
		if (nutshell.nut.type === 'auto')
			this.execNutshell(nutshell);
	});
};

Nutcracker.prototype.hasAny = function (entity, options) {
	return this.nutshells.some(nutshell => {
		if ((typeof entity === 'undefined' || nutshell.owner === entity)) {
			for (let i in options)
				if (options[i] !== nutshell.nut[i])
					return false;
			return true;
		}
	});
};

Nutcracker.prototype.execAll = function (entity, options) {
	this.nutshells.forEach(nutshell => {
		if ((typeof entity === 'undefined' || nutshell.owner === entity)) {
			for (let i in options)
				if (options[i] !== nutshell.nut[i])
					return;

			if (typeof nutshell.timer !== 'undefined') {
				nutshell.timer.pause();
				nutshell.timer = undefined;
			}
			this.execNutshell(nutshell);
		}
	});
};

Nutcracker.prototype.pauseAll = function (entity) {
	this.nutshells.forEach(nutshell => {
		if ((typeof entity === 'undefined' || nutshell.owner === entity) &&
		    typeof nutshell.timer !== 'undefined')
			nutshell.timer.pause();
	});
};

Nutcracker.prototype.resumeAll = function (entity) {
	this.nutshells.forEach(nutshell => {
		if ((typeof entity === 'undefined' || nutshell.owner === entity) &&
		    typeof nutshell.timer !== 'undefined')
			nutshell.timer.resume();
	});
};

Nutcracker.prototype.isNutshellVariable = function (nutshell, variable) {
	return typeof variable !== 'undefined' &&
	       variable.startsWith('$') &&
	       typeof this.getNutshellVariable(nutshell, variable) !== 'undefined';
};

Nutcracker.prototype.getNutshellVariable = function (nutshell, variable) {
	return nutshell.variables[variable.substr(1)] ||
	       this.variables.get(nutshell.owner)[variable.substr(1)];
};

Nutcracker.prototype.execNutshell = function (nutshell, lineNum = 0) {
	// check if EOF
	if (typeof nutshell.nut.script[lineNum] === 'undefined')
		return;

	let line = nutshell.nut.script[lineNum];
	let args = line.split(' ').filter(item => item !== '');
	let jump = lineNum => this.execNutshell(nutshell, lineNum);
	let jumpNext = () => jump(lineNum + 1);
	let addToQueue = func => nutshell.owner.queue.push(func);
	let warn = text => console.warn('Nutcracker: ' + text + ', ' +
		'owner "' + nutshell.owner.data.id + '", ' +
		'script "' + nutshell.nut.name + '", ' +
		'line ' + lineNum);

	// skip empty lines and comments
	if (line.trim() === '' || line.trim().startsWith('#')) {
		jumpNext();
		return;
	}

	// instructions
	let arg1, arg2, arg3;
	switch (args[0]) {
	case 'dec':
		if (typeof args[1] === 'undefined')
			warn('Cannot decrement a variable without a name');
		else if (typeof args[2] === 'undefined' && tools.isNumeric(nutshell.variables[args[1]]))
			--nutshell.variables[args[1]];
		else if (typeof args[2] === 'undefined' && tools.isNumeric(this.variables.get(nutshell.owner)[args[1]])) {
			let variables = this.variables.get(nutshell.owner);
			--variables[args[1]];
			this.variables.set(nutshell.owner, variables);
		}
		jumpNext();
		break;
	case 'dlg':
		if (typeof args[1] !== 'undefined' && typeof args[2] !== 'undefined') {
			arg1 = args[1];
			if (this.isNutshellVariable(nutshell, arg1))
				arg1 = this.getNutshellVariable(nutshell, arg1);
			arg2 = args[2];

			switch (arg2) {
			case 'show':
				// build the dialogue array
				let dialogue = [];
				for (let i = 0;; ++i) {
					// build the dialogue item
					let item = {};

					nutshell.nut.script.forEach(nutline => {
						let nutargs = nutline.split(' ').filter(item => item !== '');
						if (typeof nutargs[0]  !== 'undefined' &&
						           nutargs[0]  === 'dlg' &&
						    typeof nutargs[1]  !== 'undefined' &&
						           nutargs[1]  === arg1 &&
						    typeof nutargs[2]  !== 'undefined' &&
						  parseInt(nutargs[2]) === i &&
						    typeof nutargs[3]  !== 'undefined') {
							if (this.isNutshellVariable(nutshell, nutargs[1]))
								nutargs[1] = this.getNutshellVariable(nutshell, nutargs[1]);
							if (this.isNutshellVariable(nutshell, nutargs[2]))
								nutargs[2] = this.getNutshellVariable(nutshell, nutargs[2]);
							if (typeof nutargs[4] !== 'undefined' && this.isNutshellVariable(nutshell, nutargs[4]))
								nutargs[4] = this.getNutshellVariable(nutshell, nutargs[4]);
							if (typeof nutargs[5] !== 'undefined' && this.isNutshellVariable(nutshell, nutargs[5]))
								nutargs[5] = this.getNutshellVariable(nutshell, nutargs[5]);

							switch (nutargs[3]) {
							case 'text':
								if (typeof item.texts === 'undefined')
									item.texts = [];
								item.texts.push({
									text: nutline.slice(('dlg ' + nutargs[1] + ' ' + nutargs[2] + ' text ').length)
								});
								break;
							case 'choice':
								if (typeof item.choices === 'undefined')
									item.choices = [];
								item.choices.push({
									text: nutline.slice(('dlg ' + nutargs[1] + ' ' + nutargs[2] + ' choice '
									                            + nutargs[4] + ' ').length),
									action: () => this.execNutshell(this.nutshells.find(n =>
										n.owner    === nutshell.owner &&
										n.nut.type === 'choice' &&
										n.nut.name === nutargs[4]
									))
								});
								break;
							default:
								warn('Invalid dialogue instruction "' + nutargs[3] + '"');
							}
						}
					});

					// add the item to the dialogue or exit
					if (Object.keys(item).length > 0)
						dialogue.push(item);
					else
						break;
				}

				dialogue.onend = () => jumpNext();
				this.app.hud.setDialogue(dialogue);
				break;
			default:
				jumpNext();
			}
		}

		break;
	case 'lbl':
		jumpNext();
		break;
	case 'let':
		if (typeof args[1] === 'undefined')
			warn('Cannot set a variable without a name');
		else if (typeof args[2] === 'undefined')
			nutshell.variables[args[1]] = nutshell.variables[args[1]] || 0;
		else if (tools.isNumeric(args[2]))
			nutshell.variables[args[1]] = +args[2];
		else
			nutshell.variables[args[1]] = args[2];
		jumpNext();
		break;
	case 'log':
		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);
		else
			arg1 = line.slice(4);

		console.log(arg1);
		jumpNext();
		break;
	case 'inc':
		if (typeof args[1] === 'undefined')
			warn('Cannot increment a variable without a name');
		else if (typeof args[2] === 'undefined' && tools.isNumeric(nutshell.variables[args[1]]))
			++nutshell.variables[args[1]];
		else if (typeof args[2] === 'undefined' && tools.isNumeric(this.variables.get(nutshell.owner)[args[1]])) {
			let variables = this.variables.get(nutshell.owner);
			++variables[args[1]];
			this.variables.set(nutshell.owner, variables);
		}
		jumpNext();
		break;
	case 'inv':
		if (typeof args[1] === 'undefined') {
			warn('Missing inventory action parameter');
			jumpNext();
			break;
		}
		if (typeof args[2] === 'undefined') {
			warn('Missing inventory object parameter');
			jumpNext();
			break;
		}

		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);
		if (typeof args[3] !== 'undefined') {
			arg2 = line.slice(('inv ' + args[1] + ' ').length);
		} else {
			arg2 = args[2];
			if (this.isNutshellVariable(nutshell, arg2))
				arg2 = this.getNutshellVariable(nutshell, arg2);
		}

		switch (arg1) {
		case 'add':
			this.app.player.inventory.push({
				name: arg2
			});
			jumpNext();
			break;
		case 'rem':
			for (let i in this.app.player.inventory)
				if (this.app.player.inventory[i].name === arg2) {
					this.app.player.inventory.splice(i, 1);
					break;
				}
			jumpNext();
			break;
		case 'has':
			arg2 = args[2];
			if (this.isNutshellVariable(nutshell, arg2))
				arg2 = this.getNutshellVariable(nutshell, arg2);
			if (typeof args[4] !== 'undefined') {
				arg3 = line.slice(('inv ' + args[1] + ' ' + args[2] + ' ').length);
			} else {
				arg3 = args[3];
				if (this.isNutshellVariable(nutshell, arg3))
					arg3 = this.getNutshellVariable(nutshell, arg3);
			}

			let has = false;
			for (let i in this.app.player.inventory)
				if (this.app.player.inventory[i].name === arg3) {
					has = true;
					break;
				}

			if (has) {
				if (tools.isNumeric(arg2)) {
					jump(parseInt(arg2));
				} else {
					let labelPos = nutshell.nut.script.indexOf('lbl ' + arg2);
					if (labelPos === -1) {
						warn('Cannot jump to a nonexistent label "' + arg2 + '"');
						jumpNext();
					} else {
						jump(labelPos);
					}
				}
			} else {
				jumpNext();
			}
			break;
		}
		break;
	case 'jmp':
		if (typeof args[1] === 'undefined') {
			warn('Cannot jump to nowhere, missing destination parameter');
			jumpNext();
			break;
		}

		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);
		arg2 = args[2];
		if (this.isNutshellVariable(nutshell, arg2))
			arg2 = this.getNutshellVariable(nutshell, arg2);
		arg3 = args[3];
		arg4 = args[4];
		if (this.isNutshellVariable(nutshell, arg4))
			arg4 = this.getNutshellVariable(nutshell, arg4);

		if (typeof args[4] !== 'undefined') {
			if (tools.isNumeric(arg2))
				arg2 = +arg2;
			if (tools.isNumeric(arg4))
				arg4 = +arg4;

			let test = false;
			switch (arg3) {
			case '==':
				test = arg2 === arg4;
				break;
			case '!=':
				test = arg2 !== arg4;
				break;
			case '>':
				test = arg2 > arg4;
				break;
			case '>=':
				test = arg2 >= arg4;
				break;
			case '<':
				test = arg2 < arg4;
				break;
			case '<=':
				test = arg2 <= arg4;
				break;
			}
			if (!test) {
				jumpNext();
				break;
			}
		}

		if (tools.isNumeric(arg1)) {
			jump(parseInt(arg1));
		} else {
			let labelPos = nutshell.nut.script.indexOf('lbl ' + arg1);
			if (labelPos === -1) {
				warn('Cannot jump to a nonexistent label "' + arg1 + '"');
				jumpNext();
			} else {
				jump(labelPos);
			}
		}
		break;
	case 'map':
		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);
		arg2 = args[2];
		if (this.isNutshellVariable(nutshell, arg2))
			arg2 = this.getNutshellVariable(nutshell, arg2);
		arg3 = args[3];
		if (this.isNutshellVariable(nutshell, arg3))
			arg3 = this.getNutshellVariable(nutshell, arg3);

		if (typeof arg1 === 'undefined' ||
		    typeof arg2 === 'undefined')
			warn('Cannot load map, missing parameter');
		else
			this.app.loadMap(arg2, arg3, arg1);
		jumpNext();
		break;
	case 'nop':
		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);

		if (typeof arg1 !== 'undefined' && tools.isNumeric(arg1))
			nutshell.timer = new tools.Timer(jumpNext, parseInt(arg1));
		else
			jumpNext();
		break;
	case 'nut':
		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);

		let dest = this.nutshells.find(ns => ns.owner === nutshell.owner && ns.nut.name === arg1);
		if (typeof dest === 'undefined')
			warn('Cannot find nut "' + arg1 + '"');
		else
			this.execNutshell(dest);
		break;
	case 'ret':
		break;
	case 'set':
		arg1 = args[1];
		if (this.isNutshellVariable(nutshell, arg1))
			arg1 = this.getNutshellVariable(nutshell, arg1);
		arg2 = args[2];
		if (this.isNutshellVariable(nutshell, arg2))
			arg2 = this.getNutshellVariable(nutshell, arg2);
		arg3 = args[3];
		if (this.isNutshellVariable(nutshell, arg3))
			arg3 = this.getNutshellVariable(nutshell, arg3);


		switch (arg1) {
		case undefined:
		case '':
			warn('Cannot set nothing, missing required parameter');
			break;
		case 'view':
			addToQueue(() => nutshell.owner.setView(
				arg2,
				typeof arg3 === 'undefined' ? undefined : parseInt(arg3)
			));
			break;
		case 'frame':
			addToQueue(() => nutshell.owner.setFrame(
				typeof arg2 === 'undefined' ? undefined : parseInt(arg2)
			));
			break;
		}
		jumpNext();
		break;
	case 'var':
		let variables = this.variables.get(nutshell.owner);

		if (typeof args[1] === 'undefined')
			warn('Cannot set a variable without a name');
		else if (typeof args[2] === 'undefined')
			variables[args[1]] = variables[args[1]] || 0;
		else if (tools.isNumeric(args[2]))
			variables[args[1]] = +args[2];
		else
			variables[args[1]] = args[2];

		this.variables.set(nutshell.owner, variables);
		jumpNext();
		break;
	default:
		warn('Invalid instruction "' + args[0] + '"');
		jumpNext();
	}
};
