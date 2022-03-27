import Battle from "./battle";
import Socket2 from "../core/socket2";
import Player from "./player";

export default class Lobby {

	battle : Battle;
	players = [] as Player[];
	battles = [] as Battle[];
	connectedSockets = [] as Socket2[];

	constructor() {
		this.battle = this.generateNewBattle();
	}

	registerPlayer(socket: Socket2) {
		const player = {username:'', socket} as Player;
		this.players.push(player);
		return player;
	}

	generateNewBattle() {
		this.battle = new Battle();
		for (let i = 1; i <= 4; i++) this.battle.addPlayer({username: 'Bot#'+i} as Player);
		this.battles.push(this.battle);
		return this.battle;
	}

	processEnterBattle(player: Player, username: string) {
		username = username.trim();
		username = username.substring(0, 30);

		console.log("username?", username);

		if (!username) return {status: false, error: 'Você precisa escolher um nick.'};

		const already = this.battle.players.find(p => p.username == username);
		if (already) return {status: false, error: 'Esse nick já está em uso.'};


		player.username = username;
		this.battle.addPlayer(player);

		if (this.battle.isFull()) {
			this.battle.start();
			this.generateNewBattle();
		}

		this.broadcastBattleSize();

		return {status: true};
	}

	processDisconnect(player: Player) {
		this.players = this.players.filter(p => p != player);
		player.battle?.tryRemove(player);
		this.battle.tryRemove(player);
		this.broadcastBattleSize();
	}

	broadcastBattleSize() {
		this.connectedSockets.forEach(socket => this.sendBattleSize(socket));
	}

	sendBattleSize(socket: Socket2) {
		socket.emit('lobby', {'ev':'battlesize', size: this.battle.size() });
	}
}