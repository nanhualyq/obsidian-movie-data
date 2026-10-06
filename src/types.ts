export interface Movie {
	id: string;
	title: string;
	cover: string;
	tags: string[];
	actorIds: string[];
	info: string;
	url: string;
}

export interface Actor {
	id: string;
	name: string;
	cover: string;
	info: string;
	url: string;
}

export interface MovieStoreData {
	movies: Movie[];
	actors: Actor[];
}
