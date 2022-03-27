import WebSocket from "ws";
import Socket2 from "./core/socket2";
import Lobby from "./classes/lobby";

const socketPort = 3000;


const server = new WebSocket.Server({port: socketPort}, () => {
	console.log(`O websocket está escutando na porta ${socketPort}.`);
});

const lb = new Lobby();

server.on('connection', ws => {
	console.log('connected');

	const socket = new Socket2(ws, {open: true});
	const player = lb.registerPlayer(socket);

	lb.connectedSockets.push(socket);
	lb.sendBattleSize(socket);

	socket.on("lobby", (event, callback) => {
		if (event.ev == "get-lobby") {
			lb.sendBattleSize(socket);
		}

		if (event.ev == "enter-battle") {
			const result = lb.processEnterBattle(player, event.username);
			callback(result);
		}
		if (event.ev == "leave-battle") {
			lb.processDisconnect(player);
			callback({});
		}
	});

	socket.on("battle", (event, callback) => {
		console.log(event);

		if (event.ev == "get-data") {
			const data : any = player.battle?.getData() || {status: false};
			data.username = player.username;
			callback(data);
		}
		if (event.ev == "set-action") {
			player.battle?.setAction(player, event.code);
			callback({});
		}
	});

	socket.on("disconnect", event => {
		console.log("disconnect", socket.id);
		lb.processDisconnect(player);
		const index = lb.connectedSockets.indexOf(socket);
		if (index >= 0) lb.connectedSockets.splice(index, 1);
	});
});