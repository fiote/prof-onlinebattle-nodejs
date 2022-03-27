export const shuffleArray = (array: any[]) => {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

export const randomFrom = <T>(array: any[]) : T => {
	const index = Math.floor(Math.random() * array.length);
	return array[index];
}