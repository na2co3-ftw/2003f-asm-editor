export class BigInt {
	private constructor(
		private words: number[],
		private sign: boolean
	) {}

	static fromUInt32(int: number): BigInt {
		return new BigInt([int & 0xffff, int >>> 16 & 0xffff], true);
	}

	times(other: BigInt): BigInt {
		const retLength = this.words.length + other.words.length;
		let retWords = new Array(retLength);
		for (let i = 0; i < retLength; i++) {
			retWords[i] = 0;
		}
		for (let i = 0; i < this.words.length; i++) {
			if (this.words[i] == 0) {
				continue;
			}
			let current = 0;
			for (let j = 0; j < other.words.length; j++) {
				current += this.words[i] * other.words[j] + retWords[i + j];
				retWords[i + j] = current & 0xffff;
				current = current >>> 16 & 0xffff;
			}
			retWords[i + other.words.length] = current;
		}
		return new BigInt(retWords, this.sign == other.sign);
	}

	toInt32Array(): number[] {
		let dwords = new Array(Math.ceil(this.words.length / 2));
		for (let i = 0; i < dwords.length; i++) {
			dwords[i] = this.words[i * 2];
			if (i * 2 + 1 < this.words.length) {
				dwords[i] |= this.words[i * 2 + 1] << 16;
			}
		}
		return dwords;
	}
}
