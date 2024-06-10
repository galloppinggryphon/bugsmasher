import Game from './game.js'

const container = document.querySelector( '#game-container' )

document.addEventListener( 'DOMContentLoaded', () => {
	Game( container, {
		width: container.clientWidth,
		height: container.clientHeight,
	} )
} )
