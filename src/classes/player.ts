import Battle from "./battle";
import Socket2 from "../core/socket2";

export default interface Player {
	socket?: Socket2;
	battle?: Battle;
	action?: string;
	username: string;
	hp: number;
	stunned?: boolean;
}