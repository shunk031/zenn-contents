export function describe(items: string[]) {
	const heading = "Items";
	if (items.length > 0) {
		return items.map((item) => {
			return `${heading}: ${item}`;
		});
	}
	return [];
}
