import Canvas from './canvas.js'
import { delay, importJson, logIncrement } from './utils.js'

const options = importJson( '../settings.json' )
// const log = console.log.bind( console )

/** @type {Record<string, Partial<{outline: boolean, noFill: boolean} & Pick<CanvasRenderingContext2D, "fillStyle" | "lineCap" | "lineWidth" | "strokeStyle" | "shadowColor" | "shadowBlur" | "shadowOffsetX" | "shadowOffsetY" | "font" | "textAlign" | "textBaseline">>>} */
const componentStyles = {
	overlay: {
		fillStyle: 'rgba(0 0 0/0.7)',
	},
	button: {
		fillStyle: 'rgb(25, 153, 205)',
		strokeStyle: 'rgba(0 0 0 / 0)',
		lineWidth: 1,
	},
	buttonText: {
		fillStyle: 'white',
		font: 'bold 20px sans-serif',
	},
	buttonHover: {
		fillStyle: 'rgb(254, 205, 11)',
		strokeStyle: 'rgb(254, 205, 11)',
		lineWidth: 6,
	},
	buttonTextHover: {
		fillStyle: 'black',
	},
	bug: {
		fillStyle: 'rgba(0 0 0 / 0)',
		strokeStyle: 'rgba(0 0 0 / 0)',
	},
	bugHit: {
		fillStyle: 'rgba(255 0 0 / 0.3)',
		strokeStyle: 'red',
		shadowColor: 'red',
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		shadowBlur: 3,
		lineWidth: 1,
	},
	text: {
		font: 'bold 20px sans-serif',
		fillStyle: 'white',
		shadowColor: 'black',
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		shadowBlur: 3,
		strokeStyle: 'black',
		lineWidth: 1,
		outline: true,
	},
}

/**
 * @param {Element} container
 * @param {{width: number, height: number}} config
 */
export default async function Game( container, config ) {
	const { baseInterval, bugScaleFactor, maxMisses, maxRounds, speedStep } = await options

	/**
	 * Canvas controller
	 *
	 * @type {ReturnType<typeof Canvas>}
	 */
	const canvas = Canvas( container, config.width, config.height )

	/**
	 * Game data
	 */
	const gameSession = {
		isRunning: false,
		isPaused: false,
		hits: 0,
		misses: 0,
		interval: baseInterval,
		speed: 0,
		speedPct: 0,
	}

	/**
	 * Start or restart the game loop.
	 *
	 * @type {() => void}
	 */
	let startLoop

	init()

	async function init() {
		canvas.addSprite( 'background', 'sprites/background.svg', {
			svg: true,
			fitToCanvas: true,
			visible: false,
			zIndex: 0,
		} )

		canvas.addSprite( 'bug', 'sprites/bee.svg', {
			svg: false,
			scaleFactor: 0.15, // square screen: 0.3. long: w/h * 0.3
			scaleTo: 'combined',
			autoDomainMargin: true,
			zIndex: 500,
			visible: false,
			fillStyle: 'rgba(0 0 0 / 0)',
		} )

		canvas.addVectorPath( 'bug_hit_area', 'sprites/bee_shape.svg', {
			...componentStyles.bug,
			visible: false,
			scaleFactor: bugScaleFactor,
			scaleTo: 'combined',
			zIndex: 600,
			outline: true,
		} )

		canvas.addVectorShape( 'start_button', {
			shape: 'circle',
			fillStyle: 'rgb(254, 205, 11)',
			strokeStyle: 'rgb(0 0 0 / 0)',
			outline: true,
			lineWidth: 10,
			visible: false,
			radius: 60,
			x: 515,
			y: 325,
			zIndex: 100,
		} )

		canvas.addText( 'start_button_text', {
			text: '▶',
			visible: false,
			textAlign: 'center',
			font: '60px sans-serif',
			fillStyle: 'black',
			zIndex: 200,
			x: 520,
			y: 300,
		} )

		canvas.addText( 'credit_line', {
			text: 'A canvas adventure by Bjørnar Egede-Nissen',
			visible: false,
			textAlign: 'center',
			textBaseline: 'top',
			font: 'bold 20px sans-serif',
			fillStyle: 'lightgreen',
			shadowColor: 'black',
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			shadowBlur: 3,
			strokeStyle: 'black',
			lineWidth: 1,
			outline: true,
			zIndex: 200,
			x: 520,
			y: 200,
		} )

		canvas.addVectorShape( 'restart_button', {
			...componentStyles.button,
			shape: 'rectangle',
			visible: false,
			outline: true,
			width: 150,
			height: 40,
			x: canvas.width - 520,
			y: 20,
			zIndex: 100,
		} )

		canvas.addText( 'restart_button_text', {
			...componentStyles.buttonText,
			text: 'New Game',
			visible: false,
			textAlign: 'left',
			textBaseline: 'top',
			zIndex: 200,
			x: canvas.width - 490,
			y: 31,
		} )

		canvas.addVectorShape( 'reset_button', {
			...componentStyles.button,
			shape: 'rectangle',
			visible: false,
			outline: true,
			width: 150,
			height: 40,
			x: canvas.width - 340,
			y: 20,
			zIndex: 100,
		} )

		canvas.addText( 'reset_button_text', {
			...componentStyles.buttonText,
			text: 'Reset Speed',
			visible: false,
			textAlign: 'left',
			textBaseline: 'top',
			zIndex: 200,
			x: canvas.width - 320,
			y: 31,
		} )

		canvas.addVectorShape( 'resume_button', {
			...componentStyles.button,
			shape: 'rectangle',
			visible: false,
			outline: true,
			width: 140,
			height: 40,
			x: canvas.width - 160,
			y: 20,
			zIndex: 100,
		} )

		canvas.addText( 'resume_button_text', {
			...componentStyles.buttonText,
			text: '▶  Resume',
			visible: false,
			textAlign: 'right',
			textBaseline: 'top',
			zIndex: 200,
			x: canvas.width - 35,
			y: 31,
		} )

		canvas.addVectorPath( 'pause', 'sprites/pause.svg', {
			...componentStyles.text,
			visible: false,
			scaleFactor: 0.05,
			scaleTo: 'longest',
			fillStyle: 'white',
			strokeStyle: 'black',
			lineWidth: 2,
			zIndex: 300,
			x: canvas.width - 60,
			y: 20,
		} )

		canvas.addVectorShape( 'pause_hit_area', {
			shape: 'rectangle',
			fillStyle: 'rgba(0 0 0 / 0)',
			visible: false,
			width: 65,
			height: 60,
			x: canvas.width - 65,
			y: 0,
			zIndex: 100,
		} )

		canvas.addText( 'hits', {
			...componentStyles.text,
			text: 'SCORE: 0',
			visible: false,
			textAlign: 'left',
			textBaseline: 'top',
			zIndex: 200,
			x: 10,
			y: 50 + 30 + 30 + 30,
		} )

		canvas.addText( 'misses', {
			...componentStyles.text,
			text: 'MISSES: 0',
			visible: false,
			textAlign: 'left',
			textBaseline: 'top',
			zIndex: 200,
			x: 10,
			y: 50 + 30 + 30,
		} )

		canvas.addText( 'interval', {
			...componentStyles.text,
			text: 'INTERVAL:',
			visible: false,
			textAlign: 'left',
			textBaseline: 'top',
			zIndex: 200,
			x: 10,
			y: 50 + 30,
		} )

		canvas.addText( 'speed', {
			...componentStyles.text,
			text: 'SPEED: 100%',
			visible: false,
			textAlign: 'left',
			textBaseline: 'top',
			zIndex: 200,
			x: 10,
			y: 50,
		} )

		canvas.addText( 'title', {
			text: 'BUGSMASHER',
			visible: false,
			textAlign: 'center',
			textBaseline: 'top',
			font: '80px Eater',
			fillStyle: '#fecd0d',
			shadowColor: 'rgba(0 0 0 / 0.6)',
			shadowOffsetX: 5,
			shadowOffsetY: 5,
			zIndex: 200,
			x: 520,
			y: 100,
		} )

		canvas.addText( 'title_top', {
			text: 'BUGSMASHER',
			visible: false,
			textBaseline: 'top',
			font: 'bold 24px sans-serif',
			fillStyle: '#fecd0d',
			shadowColor: 'black',
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			shadowBlur: 3,
			strokeStyle: 'black',
			lineWidth: 1,
			outline: true,
			zIndex: 200,
			x: 10,
			y: 10,
		} )

		canvas.addText( 'game_over', {
			text: 'GAME OVER',
			visible: false,
			textAlign: 'center',
			textBaseline: 'top',
			font: 'bold 80px sans-serif',
			fillStyle: 'white',
			shadowColor: 'rgba(0 0 0 / 0.6)',
			shadowOffsetX: 5,
			shadowOffsetY: 5,
			zIndex: 1000,
			x: canvas.width / 2,
			y: ( canvas.height / 4 ),
		} )

		canvas.addVectorShape( 'new_game_button', {
			shape: 'rectangle',
			visible: false,
			fillStyle: 'rgb(254, 205, 1)',
			strokeStyle: 'rgb(0 0 0 / 0)',
			lineWidth: 10,
			outline: true,
			width: 200,
			height: 60,
			x: ( canvas.width / 2 ) - 100,
			y: ( canvas.height / 4 ) + 150,
			zIndex: 100,
		} )

		canvas.addText( 'new_game_button_text', {
			text: 'New Game',
			visible: false,
			textAlign: 'center',
			textBaseline: 'top',
			font: '30px sans-serif',
			fillStyle: 'black',
			zIndex: 200,
			x: canvas.width / 2,
			y: ( canvas.height / 4 ) + 165,
		} )

		canvas.addVectorShape( 'overlay', {
			shape: 'rectangle',
			visible: true,
			zIndex: 1,
			...componentStyles.overlay,
		} )

		canvas.addVectorShape( 'animated_overlay', {
			shape: 'rectangle',
			visible: true,
			zIndex: 1000,
			fillStyle: 'rgba(0 0 0 / 0)',
		} )

		// Display the loading screen for a minimum amount of time or until assets are loaded
		await Promise.all( [ loadingScreen(), canvas.spritesLoaded() ] )

		canvas.deleteComponent( 'loading_text', 'Text' )
		canvas.deleteComponent( 'loading_title', 'Text' )

		canvas.startEventListeners()

		screenTransition( () => {
			canvas.getSprite( 'background' ).show()
			titleScreen()
		} )
	}

	/**
	 * @param {() => void} halfwayCallback Things to do while the screen is black.
	 */
	function screenTransition( halfwayCallback = undefined ) {
		const overlay = canvas.getVector( 'animated_overlay' )

		const overlayFadeIn = ( { frameCoefficient } ) => {
			const opacity = frameCoefficient

			overlay.setStyle( {
				fillStyle: `rgba(0 0 0 / ${ opacity })`,
			} )
		}

		const overlayFadeOut = ( { frameCoefficient } ) => {
			const opacity = 1 - frameCoefficient

			overlay.setStyle( {
				fillStyle: `rgba(0 0 0 / ${ opacity })`,
			} )
		}

		const overlayFadeInComplete = () => {
			requestAnimationFrame( async() => {
				if ( typeof halfwayCallback === 'function' ) {
					await halfwayCallback()
				}

				canvas.animate( 'animated_overlay_fade_out', 800, overlayFadeOut )
			} )
		}

		canvas.animate( 'animated_overlay_fade_in', 800, overlayFadeIn, overlayFadeInComplete )
	}

	async function loadingScreen() {
		const title = canvas.addText( 'loading_title', {
			text: 'BUGSMASHER',
			visible: true,
			textBaseline: 'top',
			font: 'bold 30px sans-serif',
			fillStyle: '#fecd0d',
			shadowColor: 'black',
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			shadowBlur: 3,
			strokeStyle: 'black',
			lineWidth: 1,
			outline: true,
			zIndex: 200,
			x: 50,
			y: 50,
		} )

		const loading = canvas.addText( 'loading_text', {
			text: 'LOADING...',
			visible: true,
			textAlign: 'left',
			textBaseline: 'top',
			font: 'bold 26px sans-serif',
			fillStyle: 'white',
			shadowColor: 'black',
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			shadowBlur: 3,
			strokeStyle: 'black',
			lineWidth: 1,
			outline: true,
			zIndex: 200,
			x: 50,
			y: 100,
		} )

		canvas.render()

		await delay( 1000 )

		canvas.animate( 'loading_screen', 500, ( { frameCoefficient } ) => {
			const opacity = 1 - frameCoefficient

			loading.setStyle( {
				fillStyle: `rgba(255 255 255 / ${ opacity })`,
				strokeStyle: `rgba(0 0 0 / ${ opacity })`,
				shadowColor: `rgba(0 0 0 / ${ opacity })`,
			} )

			title.setStyle( {
				fillStyle: `rgba(255 255 255 / ${ opacity })`,
				strokeStyle: `rgba(0 0 0 / ${ opacity })`,
				shadowColor: `rgba(0 0 0 / ${ opacity })`,
			} )
		} )
	}

	function titleScreen() {
		canvas.getText( 'title' ).show()
		canvas.getText( 'credit_line' ).show()
		canvas.getVector( 'start_button' ).show()
		canvas.getText( 'start_button_text' ).show()

		canvas.getSprite( 'bug' )
			.setPosition( 50, 50 )
			.show()

		canvas.addClickEvent( 'start_button', ( target ) => {
			canvas.removeClickEvent( target )
			screenTransition( start )
		} )

		canvas.addEvent( 'mousemove', 'start_button',
			( target ) => {
				target.saveStyle()
				target.setStyle( {
					fillStyle: 'rgb(25, 153, 205)',
					strokeStyle: 'rgb(25, 153, 205)',
				} )
				canvas.render()
			},

			// Uncaptured event, used for mouse hover effect
			() => {
				canvas.getVector( 'start_button' ).revertStyle()
				canvas.render()
			},
		)

		canvas.clear()
		canvas.render()
	}

	function pauseScreen() {
		if ( ! gameSession.isRunning || gameSession.isPaused ) {
			return
		}

		gameSession.isPaused = true

		canvas.removeClickEvent( 'pause_hit_area' )
		canvas.removeClickEvent( 'bug_hit_area' )

		canvas.getVector( 'bug_hit_area' ).hide()
		canvas.getVector( 'pause' ).hide()
		canvas.getVector( 'pause_hit_area' ).hide()
		canvas.getVector( 'overlay' ).setStyle( componentStyles.overlay )

		const restart = canvas.getVector( 'restart_button' ).show()
		const restartText = canvas.getText( 'restart_button_text' ).show()
		const reset = canvas.getVector( 'reset_button' ).show()
		const resetText = canvas.getText( 'reset_button_text' ).show()
		const resume = canvas.getVector( 'resume_button' ).show()
		const resumeText = canvas.getText( 'resume_button_text' ).show()

		canvas.render()

		const restartButtonObserver = newMouseLeaveObserver()
		canvas.addEvent( 'mousemove', restart,
			() => {
				restart.setStyle( componentStyles.buttonHover )
				restartText.setStyle( componentStyles.buttonTextHover )

				canvas.render()

				if ( ! restartButtonObserver.isObserving ) {
					restartButtonObserver.observe( restart, () => {
						restart.setStyle( componentStyles.button )
						restartText.setStyle( componentStyles.buttonText )
						canvas.render()
					} )
				}
			},
		)

		const resumeButtonObserver = newMouseLeaveObserver()
		canvas.addEvent( 'mousemove', 'resume_button',
			( target ) => {
				resume.setStyle( componentStyles.buttonHover )
				resumeText.setStyle( componentStyles.buttonTextHover )
				canvas.render()

				if ( ! resumeButtonObserver.isObserving ) {
					resumeButtonObserver.observe( target, () => {
						resume.setStyle( componentStyles.button )
						resumeText.setStyle( componentStyles.buttonText )
						canvas.render()
					} )
				}
			},
		)

		const resetButtonObserver = newMouseLeaveObserver()
		canvas.addEvent( 'mousemove', 'reset_button',
			( target ) => {
				reset.setStyle( componentStyles.buttonHover )
				resetText.setStyle( componentStyles.buttonTextHover )
				canvas.render()

				if ( ! resetButtonObserver.isObserving ) {
					resetButtonObserver.observe( target, () => {
						reset.setStyle( componentStyles.button )
						resetText.setStyle( componentStyles.buttonText )
						canvas.render()
					} )
				}
			},
		)

		canvas.addClickEvent( 'restart_button', ( target ) => {
			canvas.removeClickEvent( target )
			canvas.removeClickEvent( 'resume_button' )
			canvas.removeClickEvent( 'reset_button' )

			canvas.removeEvent( 'mousemove', target )
			canvas.removeEvent( 'mousemove', 'resume_button' )
			canvas.removeEvent( 'mousemove', 'reset_button' )

			canvas.clear()
			canvas.render()

			screenTransition( start )
		} )

		canvas.addClickEvent( 'reset_button', ( target ) => {
			gameSession.speed = 0
			gameSession.interval = baseInterval

			canvas.getText( 'speed' ).setText( `SPEED: 100%` )
			canvas.getText( 'interval' ).setText( `INTERVAL: ${ gameSession.interval }ms` )

			canvas.render()
		} )

		canvas.addClickEvent( 'resume_button', async( target ) => {
			gameSession.isPaused = false

			canvas.removeClickEvent( target )
			canvas.removeClickEvent( 'resume_button' )
			canvas.removeClickEvent( 'reset_button' )

			canvas.removeEvent( 'mousemove', target )
			canvas.removeEvent( 'mousemove', 'reset_button' )
			canvas.removeEvent( 'mousemove', 'restart_button' )

			// canvas.render()
			startLoop()
		} )
	}

	function gameOverScreen() {
		gameSession.isRunning = false
		gameSession.isPaused = false

		canvas.removeClickEvent( 'bug_hit_area' )
		canvas.removeClickEvent( 'pause_hit_area' )

		screenTransition( () => {
			canvas.getVector( 'pause' ).hide()
			canvas.getVector( 'pause_hit_area' ).hide()
			canvas.getVector( 'overlay' ).setStyle( componentStyles.overlay )
			canvas.getSprite( 'bug' )
				.setScale( 0.15, 'combined' )
				.setPosition( ( canvas.width / 2 ) + 50, ( canvas.height / 2 ) + 50 )
				.show()

			canvas.getText( 'game_over' ).show()
			const newGame = canvas.getVector( 'new_game_button' ).show()
			const newGameText = canvas.getText( 'new_game_button_text' ).show()

			canvas.clear()
			canvas.render()

			const newGameButtonObserver = newMouseLeaveObserver()
			canvas.addEvent( 'mousemove', 'new_game_button',
				() => {
					newGame.saveStyle()
					newGameText.saveStyle()

					newGame.setStyle( {
						fillStyle: 'black',
						strokeStyle: 'black',
					} )

					newGameText.setStyle( {
						fillStyle: 'rgb(254, 205, 1)',
					} )

					canvas.render()

					if ( ! newGameButtonObserver.isObserving ) {
						newGameButtonObserver.observe( newGame, () => {
							newGame.revertStyle()
							newGameText.revertStyle()
							canvas.render()
						} )
					}
				},
			)

			setTimeout( () => {
				canvas.addClickEvent( 'new_game_button', ( target ) => {
					canvas.removeClickEvent( target )
					canvas.removeEvent( 'mousemove', target )

					screenTransition( () => {
						canvas.getText( 'game_over' ).hide()
						canvas.getVector( 'new_game_button' ).hide()
						canvas.getText( 'new_game_button_text' ).hide()
						start()
					} )
				} )
			}, 500 )
		} )
	}

	/**
	 * Prepare and start a game session.
	 */
	function start() {
		gameSession.isRunning = false
		gameSession.isPaused = false
		gameSession.hits = 0
		gameSession.misses = 0
		gameSession.speed = 0
		gameSession.interval = baseInterval

		canvas.removeEvent( 'mousemove', 'start_button' )

		canvas.getSprite( 'bug' )
			.setScale( bugScaleFactor, 'combined' )
			.hide()

		canvas.getVector( 'overlay' ).setStyle( { fillStyle: 'rgba(0 0 0 / 0.1)' } )
		canvas.getText( 'title' ).hide()
		canvas.getText( 'credit_line' ).hide()
		canvas.getVector( 'start_button' ).hide()
		canvas.getText( 'start_button_text' ).hide()

		canvas.getVector( 'restart_button' ).hide()
		canvas.getText( 'restart_button_text' ).hide()
		canvas.getVector( 'reset_button' ).hide()
		canvas.getText( 'reset_button_text' ).hide()
		canvas.getVector( 'resume_button' ).hide()
		canvas.getText( 'resume_button_text' ).hide()

		canvas.getText( 'hits' ).setText( `SCORE: 0` ).show()
		canvas.getText( 'misses' ).setText( `MISSES: 0` ).show()
		canvas.getText( 'speed' ).setText( `SPEED: 100%` ).show()
		canvas.getText( 'interval' ).setText( `INTERVAL: ${ Math.round( gameSession.interval ) }ms` ).show()
		canvas.getText( 'title_top' ).show()

		canvas.render()

		setTimeout( gameLoop, 1000 )
	}

	/**
	 * Run and control a game session.
	 */
	function gameLoop() {
		if ( gameSession.isRunning ) {
			return
		}

		startWindowFocusOutObserver()

		const bug = canvas.getSprite( 'bug' )
		const bugHitArea = canvas.getVector( 'bug_hit_area' )

		let loopTimer
		let round = 0

		/**
		 * Control whether to use click grace period.
		 *
		 * `0`: No grace activated | `1`: Start grace period | `2`: In grace period | `-1`: Grace unavailable
		 *
		 * @type {-1|0|1|2}
		 */
		let showGrace = 0
		let graceTimer

		const bugHitHandler = () => {
			gameSession.hits++
			gameSession.gracePeriod = logIncrement( gameSession.hits * -1, baseInterval / 12, baseInterval, 10 )
			gameSession.speed = logIncrement( gameSession.hits, speedStep, baseInterval, 100 )
			gameSession.interval -= gameSession.speed
			gameSession.speedPct = 100 + ( 100 - Math.round( ( gameSession.speed / speedStep ) * 100 ) )
		}

		/**
		 * Game loop - iterates game.
		 */
		const loop = () => {
			if ( ! gameSession.isRunning || gameSession.isPaused ) {
				return
			}

			// Cancel grace period and continue loop
			if ( showGrace > 1 ) {
				showGrace = -1
				clearInterval( graceTimer )
			}
			// Interrupt loop and start grace period
			else if ( showGrace === 1 ) {
				showGrace = 2

				graceTimer = setTimeout( () => {
					// Call next loop when grace period expires, unless aborted in the meantime
					if ( showGrace ) {
						loop()
					}
				}, gameSession.gracePeriod )
				return
			}

			loopTimer = setTimeout( loop, gameSession.interval )

			bug.show().setPosition()
			bugHitArea.show().setPosition( bug.x, bug.y )

			canvas.clear()
			canvas.render()

			showGrace = 0
			round++

			if ( round >= maxRounds || gameSession.misses >= maxMisses ) {
				clearInterval( loopTimer )
				gameSession.isRunning = false
				gameOverScreen()
			}
		}

		/**
		 * Start or resume game loop.
		 */
		startLoop = () => {
			canvas.getVector( 'overlay' ).setStyle( { fillStyle: 'rgba(0 0 0 / 0.1)' } )
			canvas.getVector( 'restart_button' ).hide()
			canvas.getText( 'restart_button_text' ).hide()
			canvas.getVector( 'reset_button' ).hide()
			canvas.getText( 'reset_button_text' ).hide()
			canvas.getVector( 'resume_button' ).hide()
			canvas.getText( 'resume_button_text' ).hide()
			canvas.getVector( 'pause' ).show()
			canvas.getVector( 'pause_hit_area' ).show()

			canvas.getSprite( 'bug' ).show()
			canvas.getVector( 'bug_hit_area' ).show()

			canvas.clear()
			canvas.render()

			canvas.addClickEvent( 'bug_hit_area',
				( target ) => {
					clearTimeout( loopTimer )

					bugHitHandler()

					canvas.getText( 'hits' ).setText( `SCORE: ${ gameSession.hits }` )
					canvas.getText( 'speed' ).setText( `SPEED: ${ gameSession.speedPct }%` )
					canvas.getText( 'interval' ).setText( `INTERVAL: ${ Math.round( gameSession.interval ) }ms` )
					target.setStyle( componentStyles.bugHit )

					canvas.animate( 'hit_animation', 1000, ( { frameCoefficient } ) => {
						const opacity = 1 - frameCoefficient

						target.setStyle( {
							fillStyle: `rgba(255 0 0 / ${ opacity })`,
							strokeStyle: `rgba(255 0 0 / ${ opacity })`,
							shadowColor: `rgba(255 0 0 / ${ opacity })`,
						} )
					} )

					loop()
				},

				// Capture clicks outside the bug
				( target ) => {
					gameSession.misses++
					canvas.getText( 'misses' ).setText( `MISSES: ${ gameSession.misses }` )

					if ( gameSession.misses >= maxMisses && gameSession.isRunning ) {
						canvas.removeClickEvent( target )
						gameOverScreen()
					}
					else {
						canvas.render()
					}
				},
			)

			canvas.addEvent( 'mousemove', 'bug_hit_area', () => {
				// Enable grace period, but only if grace is available/not active
				if ( ! showGrace ) {
					showGrace = 1
				}
			} )

			canvas.addClickEvent( 'pause_hit_area', ( target ) => {
				clearTimeout( loopTimer )
				canvas.removeClickEvent( target )
				pauseScreen()
			} )

			const pauseButtonObserver = newMouseLeaveObserver()
			canvas.addEvent( 'mousemove', 'pause_hit_area',
				( target ) => {
					canvas.getVector( 'pause' ).setStyle( {
						fillStyle: 'rgb(254, 205, 11)',
						lineWidth: 4,
					} )
					canvas.render()

					if ( ! pauseButtonObserver.isObserving ) {
						pauseButtonObserver.observe( target, () => {
							canvas.getVector( 'pause' ).setStyle( {
								fillStyle: 'white',
								lineWidth: 2,
							} )
							canvas.render()
						} )
					}
				},
			)

			gameSession.isRunning = true
			loop()
		}

		startLoop()
	}

	/**
	 * Pause game if window/tab loses focus.
	 */
	function startWindowFocusOutObserver() {
		window.addEventListener( 'blur', () => {
			pauseScreen()
		} )
	}

	/**
	 * Detect when the mouse leaves a canvas vector.
	 *
	 * Checks the mouse position on a small interval.
	 */
	function newMouseLeaveObserver() {
		let mouseoutTimer
		return {
			get isObserving() {
				return mouseoutTimer !== undefined
			},
			observe( target, callback ) {
				mouseoutTimer = setInterval( () => {
					const [ x, y ] = canvas.mousePosition

					if ( ! target.isPointInPath( x, y ) ) {
						callback()
						clearInterval( mouseoutTimer )
						mouseoutTimer = undefined
					}
				}, 20 )
			},
		}
	}
}
