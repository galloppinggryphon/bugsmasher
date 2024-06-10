
/**
 * Aync/await delay.
 *
 * @param {number} ms
 */
export function delay( ms ) {
	return new Promise( ( resolve ) => setTimeout( () => {
		resolve()
	}, ms ) )
}

/**
 * Read and parse JSON file.
 *
 * @param {string} url
 */
export async function importJson( url ) {
	return fetch( url )
		.then( ( response ) => response.json() )
}

/**
 * Read contents of text file.
 *
 * @param {string} url
 */
export async function loadFile( url ) {
	return fetch( url )
		.then( ( response ) => {
			return response.text()
		} )
}

/**
 * Read contents of SVG file and return as data URL.
 *
 * @param {string} url
 */
export async function loadSvg( url ) {
	const svgElement = await loadFile( url )
	return `data:image/svg+xml;utf-8,${ encodeURIComponent( svgElement ) }`

	// Alt method:
	// const b64 = btoa( svgElement )
	// return `data:image/svg+xml;base64,${ b64 }`
}

/**
 * "Hook" style asynchronous setter and getter that can be used in other asynchronous functions.
 *
 * @template InitialState
 * @param {InitialState} [initialState]
 * @param {(newValue: any, previousValue: InitialState) => InitialState} onResolveCallback
 * @return {[Promise<InitialState>, (newValue: any) => void]}
 */
export function resolver( initialState, onResolveCallback = undefined ) {
	const data = { current: initialState }

	let resolve
	/** @type {Promise<InitialState>} */
	const promise = new Promise( ( r ) => resolve = r )

	return [ promise, ( newValue ) => {
		data.current = onResolveCallback ? onResolveCallback( newValue, data.current ) : newValue
		resolve( data.current )
	} ]
}

/**
 * Return random integer between min and max, exclusive.
 *
 * @param {number} min
 * @param {number} max
 */
export function randomInt( min, max ) {
	const rand = Math.random()
	min = Math.ceil( min )
	max = Math.floor( max )
	return Math.floor( ( rand * ( max - min + 1 ) ) + min )
}

/**
 * Calculate an exponential increment based on an initial size and increment.
 *
 * @param {number} value
 * @param {number} increment
 * @param {number} interval
 * @param {number} factor
 */
export function logIncrement( value, increment, interval, factor ) {
	return ( 1 / Math.exp( value * ( increment / interval ) ) ) * factor
}
