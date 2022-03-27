import Player from "./player";
import { shuffleArray, randomFrom } from "../tools/array";

export default class Battle {

	players = [] as Player[];
	team1 = [] as Player[];
	team2 = [] as Player[];

	timer = 0;
	maxHP = 3;
	botsready = false;
	duration = 10;
	waitafter = 5;
	running = false;

	addPlayer(player: Player) {
		player.battle = this;
		this.players.push(player);
	}

	tryRemove(player: Player) {
		this.players = this.players.filter(p => p != player);
		const realuser = this.players.find(p => p.socket);
		if (this.running && !realuser) this.stopBattle();
	}

	isFull() {
		return this.size() == 6;
	}

	getData() {
		return {
			status: true,
			timer: this.timer,
			team1: this.team1.map(player => ({username: player.username})),
			team2: this.team2.map(player => ({username: player.username})),
		};
	}

	size() {
		return this.players.length;
	}

	start() {
		this.running = true;
		shuffleArray(this.players);

		this.players.forEach(player => {
			player.hp = this.maxHP;
			player.stunned = false;
		});

		this.team1 = this.players.slice(0,3);
		this.team2 = this.players.slice(3);

		this.startTurn(true);

		this.players.forEach(player => {
			player.socket?.emit('lobby', {ev:'go-battle'});
		});
	}

	itTurn? : number;

	startTurn(first: boolean) {
		this.timer = this.duration;
		this.botsready = false;

		if (!first) this.players.forEach(player => {
			player.action = "";
			player.socket?.emit('battle', {ev:'start-turn', timer: this.timer, hp: player.hp, stunned: player.stunned});
		});

		this.itTurn = setInterval(ev => {
			this.timer--;
			if (!this.timer) this.execTurn();
		},1000);

		setTimeout(() => {
			this.botsready = true;
			const bots = this.players.filter(player => !player.socket && player.hp);
			const acts = ['attack','defend','magic'];
			bots.forEach(player => {
				const code = randomFrom<string>(acts);
				this.setAction(player, code);
			});
			this.checkEndTurn();
		},2000);
	}

	turnlog = [] as any[];

	execTurn() {
		if (this.itTurn) clearInterval(this.itTurn);
		if (!this.running) return;

		this.players.forEach(player => {
			player.stunned = false;
			player.socket?.emit('battle', {ev:'lock-action'});
		});

		this.turnlog = [];

		const t1 = this.team1.filter(player => player.hp);
		shuffleArray(t1);

		const t2 = this.team2.filter(player => player.hp);
		shuffleArray(t2);

		const ta = t1.length > t2.length ? t1 : t2;
		const tb = ta == t1 ? t2 : t1;

		for (let i = 0; i < ta.length; i++) {
			const p1 = ta[i];
			const p2 = tb[i] || randomFrom<Player>(tb);

			this.turnlog.push({
				type: 'match',
				p1: this.getPlayerData(p1),
				p2: this.getPlayerData(p2)
			});

			this.execMatch(p1,p2);

			this.turnlog.push({
				type: 'update',
				p1: this.getPlayerData(p1),
				p2: this.getPlayerData(p2)
			});
		}

		this.players.forEach(player => {
			player.socket?.emit('battle', {ev:'turn-result', log: this.turnlog});
		});

		const alive1 = this.team1.some(player => player.hp);
		const alive2 = this.team2.some(player => player.hp);

		if (alive1 && alive2) {
			setTimeout(() => this.startTurn(false), this.waitafter * 1000);
		} else {
			setTimeout(() => this.sendExit(alive1 ? this.team1 : this.team2), this.waitafter * 1000);
			this.stopBattle();
		}
	}

	sendExit(winner: Player[]) {
		this.players.forEach(player => {
			const result = (winner.indexOf(player) >= 0) ? "O SEU TIME GANHOU" : "O SEU TIME PERDEU";
			player.socket?.emit('battle', {ev:'end-game', result});
		});
	}

	getPlayerData(player: Player) {
		const {username, action, hp, stunned} = player;
		return {username, action, hp, stunned};
	}

	execMatch(p1: Player, p2: Player) {
		const a1 = p1.action || '';
		const a2 = p2.action || '';

		const mapping = {
			'attack-': () => this.dmg(p2, 2),
			'-attack': () => this.dmg(p1, 2),
			'attack-attack': () => this.dmg(p1, 1) && this.dmg(p2, 1),
			'attack-defend': () => this.stun(p1),
			'attack-magic': () => this.dmg(p2, 1) && this.stun(p2),

			'defend-': () => this.stun(p2),
			'-defend': () => this.stun(p1),
			'defend-attack': () => this.stun(p2),
			'defend-defend': () => {},
			'defend-magic': () => this.stun(p1),

			'magic-': () => this.dmg(p2, 2),
			'-magic': () => this.dmg(p1, 2),
			'magic-attack': () => this.dmg(p1, 1) && this.stun(p1),
			'magic-defend': () => this.stun(p2),
			'magic-magic': () => this.dmg(p1, 1) && this.stun(p1) && this.dmg(p2, 1) && this.stun(p2),

			'-': () => {}
		} as Record<string, () => void>;

		const key = a1+'-'+a2;
		mapping[key]();
	}

	stopBattle() {
		this.running = false;
	}

	dmg(player: Player, amount: number) {
		player.hp -= amount;
		player.hp = Math.max(0, player.hp);

		this.turnlog.push({
			type: 'damage',
			player: player.username,
			amount,
			newhp: player.hp
		});
		return true;
	}

	stun(player: Player) {
		player.stunned = true;

		this.turnlog.push({
			type: 'stun',
			player: player.username,
		});
		return true;
	}

	setAction(player: Player, code: string) {
		if (player.stunned) return;
		if (!player.hp) return;
		if (!this.running) return;

		player.action = code;
		this.broadcastActions(false);
		if (player.socket) this.checkEndTurn();
	}

	broadcastActions(fulldata: boolean) {
		const actions = this.players.map(player => {
			const flag = !!player.action;
			const action = fulldata ? player.action : '';
			return {username: player.username, flag, action};
		});

		this.players.forEach(player => {
			player.socket?.emit('battle', {ev:'set-actions', actions});
		});
	}

	checkEndTurn() {
		if (!this.botsready) return;
		const missing = this.players.find(player => player.socket && !player.stunned && player.hp && !player.action);
		if (!missing) this.execTurn();
	}
}