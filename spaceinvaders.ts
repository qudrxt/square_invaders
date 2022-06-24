import { fromEvent, interval } from 'rxjs'; 
import { map, filter, scan, merge } from 'rxjs/operators';

function spaceinvaders() {
  class Step { constructor(public readonly horiStep: number, public readonly vertStep: number) {} }
  class Shoot { constructor(public readonly playerShot: boolean) {} }
  
  type Event = "keydown" | "keyup"
  type Key = "ArrowLeft" | "ArrowRight" | "Space"
  
  type Shield = Readonly<{
    shieldBody: Body;
    shieldHits: ReadonlyArray<ReadonlyArray<number>>
  }>

  type Body = Readonly<{

    // Inspired by Tim Dwyer's Astroid implementation

    bodyId: number;
    xPos: number;
    yPos: number;
    bodyWidth: number;
    bodyHeight: number;
  }>
  
  type State = Readonly<{ 

    // Inspired by Tim Dwyer's Astroid implementation

    statePlayer: Body;
    activePShots: ReadonlyArray<Body>;
    expiredPShots: ReadonlyArray<Body>; 
    activeAliens: ReadonlyArray<ReadonlyArray<Body>>;
    activeEShots: ReadonlyArray<Body>;
    expiredEShots: ReadonlyArray<Body>;
    bottomAliens: ReadonlyArray<Body>;
    leftMostAlien: Body;
    rightMostAlien: Body;
    gameShields: ReadonlyArray<Shield>;
    emenyLatDirection: number;
    alienDownShift: boolean;
    idSequence: number;
    gameScore: number;
    playerLives: number;
    gameOver: boolean;
    resetAliens: boolean
  }>

  const 
    I_COMB = <T>(i: T) => i,
    NOT_NULL = <T>(subValue: T) => subValue != null,
    PLAYER_Id = 0,
    P_SHOT_WIDTH = 2,
    P_SHOT_HEIGHT = 15,
    E_SHOT_WIDTH = 3,
    E_SHOT_HEIGHT = 35,
    SHIELD_WIDTH = 80,
    SHIELD_HEIGHT = 50,
    TWO_LIVES_COLOUR = "#000099",
    ONE_LIFE_COLOUR = "#00004d",
    DEAD_COLOUR = "#292924",
    SVG_CANVAS = document.getElementById("canvas")!,
    SHOT_GROUP = document.getElementById("shotGroup"),
    GAME_SCORE = document.getElementById("gameScore")!,
    PLAYER_LIVES = document.getElementById("playerLives")!,
    CANVAS_WIDTH = Number(document.getElementById("canvas").getAttribute("width")),
    CANVAS_HEIGHT = Number(document.getElementById("canvas").getAttribute("height")),
    PLAYER_ELE = document.getElementById("player")!,
    PLAYER_WIDTH = Number(PLAYER_ELE.getAttribute("width")),
    PLAYER_HEIGHT = Number(PLAYER_ELE.getAttribute("height")),
    VIS_LEFT_BOUND = 0,
    VIS_RIGHT_BOUND = 560,
    P_LEFT_BOUND = -PLAYER_WIDTH,
    P_RIGHT_BOUND = CANVAS_WIDTH + PLAYER_WIDTH,

    initState: State = { 
      statePlayer: createBody(null, 280, 535, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_Id),
      activePShots: [],
      expiredPShots: [],
      activeAliens: createAliens(),
      activeEShots: [],
      expiredEShots: [],
      bottomAliens: null,
      leftMostAlien: null,
      rightMostAlien: null,
      gameShields: [createBody(null, 50, 425, SHIELD_WIDTH, SHIELD_HEIGHT, 1), createBody(null, 190, 425, SHIELD_WIDTH, SHIELD_HEIGHT, 2), createBody(null, 330, 425, SHIELD_WIDTH, SHIELD_HEIGHT, 3), createBody(null, 470, 425, SHIELD_WIDTH, SHIELD_HEIGHT, 4)].map(createShield),
      emenyLatDirection: 1,
      alienDownShift: false,
      idSequence: 5,
      gameScore: 0,
      playerLives: 3,
      gameOver: false,
      resetAliens: false
    }

  // Inspired by Tim Dwyer's Astroid implementation

  const
    startLeftStep = observeKey("keydown", "ArrowLeft", true, () => new Step(-5, 0)),
    stopLeftStep = observeKey("keyup", "ArrowLeft", true, () => new Step(0, 0)),
    startRightStep = observeKey("keydown", "ArrowRight", true, () => new Step(5, 0)),
    stopRightStep = observeKey("keyup", "ArrowRight", true, () => new Step(0, 0)),
    startShoot = observeKey('keydown','Space', false, () => new Shoot(true))
    
  // Create the shield elements onto the screen

  initState.gameShields.forEach(gameShield => createElement(gameShield.shieldBody, "#00ff00", 0, SHOT_GROUP, true))

  // Create the uncreated 'Alien' elements onto the document
  
  setAliens(initState)

  function setAliens(curState: State) {
    flatMap(curState.activeAliens, I_COMB).forEach((subBody: Body) => createElement(subBody, "red"))
  }

  function createAliens() {
    return [0, 1, 2].map(yInc => createAlienCoords(0, yInc, []).map((cordList: ReadonlyArray<number>) => createBody(null, cordList[0], cordList[1], PLAYER_WIDTH, PLAYER_HEIGHT, Number(String(cordList[0]) + String(cordList[1])))))
  }

  function flatMap(inpList, flatFunc) {
    return inpList.reduce((accList, subEle) => accList.concat(flatFunc(subEle)), [])
  }

  function createPShotBody(curState: State): Body {

    // xPos centers the Shot between the Player, yPos elevates the Shot above the Player

    const xPos = curState.statePlayer.xPos + PLAYER_WIDTH / 2 - P_SHOT_WIDTH / 2,
          yPos = curState.statePlayer.yPos - 5

    return createBody(curState, xPos, yPos, P_SHOT_WIDTH, P_SHOT_HEIGHT, null)
  }

  function createAlienCoords(xInc: number, yInc: number, coordList: ReadonlyArray<ReadonlyArray<number>>) {
    return xInc == 9 ? coordList : createAlienCoords(xInc + 1, yInc, coordList.concat([[40 + 60 * xInc, 40 + 60 * yInc]]))
  }

  function observeKey<T> (eventName: Event, keyName: Key, allowRepeat: boolean, resultFunc: () => T) {

    // Inspired by Tim Dwyer's Astroid implementation

    return fromEvent<KeyboardEvent> (document, eventName)
            .pipe(
              filter(({code}) => code === keyName),
              filter(({repeat}) => repeat == allowRepeat || !repeat),
              map(resultFunc)
            )
  }

  function moveBody(inpBody: Body, e: Step | Shoot): Body {

    // Step denotes a move of the Player or Alien body - otherwise Shot

    return inpBody ? e instanceof Step  ? 
        {...inpBody, 
          xPos: latChange(inpBody, e.horiStep),
          yPos: inpBody.yPos + e.vertStep} 
        
          : 

        {...inpBody, 
          yPos: inpBody.yPos + 1}

          :
        
        null
  }

  function reduceState(curState: State, e: Step | Shoot): State {

    // Inspired from Tim Dwyer's Astroid implementation

    // check if all the Aliens had been defeated

    curState.resetAliens ?
      setAliens(curState)
    :
      null

    // Check if all Aliens have been defeated

    const
      nextRound = flatMap(curState.activeAliens, I_COMB).filter(NOT_NULL).length == 0
    
    // Player's position is updated in this function

    const updatedState 
      = e instanceof Step ? {...curState, 
          statePlayer: moveBody(curState.statePlayer, e)
        } : 
                        
        // Invoke a shooting threshold of 10 active shots per 10ms

        e instanceof Shoot ? 
          curState.activePShots.length < 2 ? {...curState, 
            activePShots: curState.activePShots.concat([createPShotBody(curState)]), 
            idSequence: curState.idSequence + 1
          } 
                              
        // If the threshold has been violated

          : curState

        : gameTick(curState) 

    return nextRound ?
        {...updatedState,
        activeAliens: createAliens(),
        resetAliens: true}
      :
        curState.resetAliens ?
        {...updatedState,
        resetAliens: false}
      :
        updatedState
  }

  function createEShotBody(curState: State) {
    const closestAlien = 
      detClosedAlien(curState.bottomAliens.slice(1), curState.bottomAliens[0], curState.statePlayer.xPos)

    const 
      shotChance = Math.random(),
      xPos = closestAlien ? closestAlien.xPos + closestAlien.bodyWidth / 2 - E_SHOT_WIDTH / 2 : null,
      yPos = closestAlien ? closestAlien.yPos + closestAlien.bodyHeight : null

    // There is a 1% chance for an Alien to shoot

    return shotChance <= 0.01 ? closestAlien ? createBody(curState, xPos, yPos, E_SHOT_WIDTH, E_SHOT_HEIGHT, null) : null : null
  }

  function incrementId(inpState: State): State {
    return {...inpState,
      idSequence: inpState.idSequence + 1}
  }

  function detClosedAlien(alienList: ReadonlyArray<Body>, curClosest: Body, playerXPos: number): Body {
    const 
      propAlien = alienList.length > 0 ? 
                    curClosest && alienList[0] ?
                      Math.abs(curClosest.xPos - playerXPos) < Math.abs(alienList[0].xPos - playerXPos) ?
                        curClosest
                      :
                        alienList[0]
                    :
                      curClosest ? 
                        curClosest 
                      :
                        alienList[0]
                  : curClosest
    
    return alienList.length > 0 ? 
            detClosedAlien(alienList.slice(1), propAlien, playerXPos) 
           : 
            propAlien
  }

  function gameTick(curState: State): State {

    // Inspired by Tim Dwyer's Astroid implementation

    // Shot(s)' and Ememy(s)' position are updated in this function

    const

      // Check if the Shot body has surpassed the top of the screen

      pShotPredicate = (shotBody: Body) => (shotBody.yPos + shotBody.bodyHeight < 0),
      eShotPredicate = (shotBody: Body) => (shotBody.yPos > CANVAS_HEIGHT),
      expPShots = curState.activePShots.filter(pShotPredicate),
      expEShots = curState.activeEShots.filter(eShotPredicate),

      // Find all non-expired shots and update their Body 

      actPShots = curState.activePShots.filter(subShot => !expPShots.includes(subShot)).map(shotBody => moveShot(shotBody, 5)),
      actEShots = curState.activeEShots.filter(subShot => !expEShots.includes(subShot)).map(shotBody => moveShot(shotBody, -5))

    const 

      // Reset the left and right-most boundaries of the updated State object

      updatedBoundaries = resetAlienBoundaries(curState),

      // Reset the bottom-level aliens of the State

      updatedBottomAliens = resetBottomAliens(updatedBoundaries.activeAliens),

      // Determine the move that aliens should make

      alienMoveDirection = updatedBoundaries.alienDownShift ? [curState.emenyLatDirection, 0] : alienDirection(updatedBoundaries),

      // Move all ememies by a lateral and maybe vertical change

      updatedAliens = updatedBoundaries.activeAliens.map(subList => subList.map(alienBody => moveBody(alienBody, new Step(alienMoveDirection[0], alienMoveDirection[1])))),

      // Create an Alien shot if the bottom aliens have been set

      alienShot = curState.bottomAliens ? createEShotBody(updatedBoundaries) : null,

      // Increment the id sequence if an Alien Shot was created

      updatedState = alienShot ? 
        incrementId(updatedBoundaries)
      :
        updatedBoundaries

    // Add a shot by an Alien if there < 1 active shots

    return handleCollisions({...updatedState, 
      activePShots: actPShots, 
      expiredPShots: expPShots,
      activeEShots: updatedBoundaries.activeEShots.length < 1 ? alienShot ? actEShots.concat([alienShot]) : actEShots : actEShots,
      expiredEShots: expEShots,
      activeAliens: updatedAliens,
      bottomAliens: updatedBottomAliens,
      emenyLatDirection: alienMoveDirection[0] == 0 ? updatedBoundaries.emenyLatDirection * -1 : updatedBoundaries.emenyLatDirection,
      alienDownShift: alienMoveDirection[0] == 0 ? true : false
    })
  }

  function alienDirection(curState: State): ReadonlyArray<number> {
    const
      exceededBound = curState.leftMostAlien ? 
                        curState.rightMostAlien ?
                          curState.leftMostAlien.xPos <= VIS_LEFT_BOUND || curState.rightMostAlien.xPos >= VIS_RIGHT_BOUND 
                        : null
                      : null

    // Determine the move that Alien bodies should make

    return exceededBound ? [0, 2.5] : [curState.emenyLatDirection, 0] 
  }

  function resetBottomAliens(alienList: ReadonlyArray<ReadonlyArray<Body>>, accBottomList = [], curInd = 0): ReadonlyArray<Body> {
    return curInd == 9 ? accBottomList :
      resetBottomAliens(alienList, accBottomList.concat(getBottomAlien(alienList, curInd)), curInd + 1)
  } 

  function getBottomAlien(alienList: ReadonlyArray<ReadonlyArray<Body>>, colInd: number, bottomAlien: Body = null, rowInd: number = 0): Body {
    const subAlien = alienList[rowInd][colInd],
          propAlien = subAlien ? subAlien : bottomAlien

    return rowInd == 2 ? propAlien : getBottomAlien(alienList, colInd, propAlien, rowInd + 1) 
  } 

  function resetAlienBoundaries(curState: State): State {
    const
      flatList = flatMap(curState.activeAliens, I_COMB),
      lMostAlien = findBoundary(flatList.slice(1), flatList[0], "<"),
      rMostAlien = findBoundary(flatList.slice(1), flatList[0], ">")

    return {
      ...curState,
      leftMostAlien: lMostAlien,
      rightMostAlien: rMostAlien
    }
  }

  function findBoundary(alienList: ReadonlyArray<Body>, boundaryAlien: Body, alienComparator: String): Body {    

    // Ternary inception

    return alienList.length > 0 ?
      alienList[0] && boundaryAlien ?
        eval(`${boundaryAlien.xPos} ${alienComparator} ${alienList[0].xPos}`) ?
          findBoundary(alienList.slice(1), boundaryAlien, alienComparator)
        : 
          findBoundary(alienList.slice(1), alienList[0], alienComparator) 
      :
        alienList[0] ?
          findBoundary(alienList.slice(1), alienList[0], alienComparator)
        :
          findBoundary(alienList.slice(1), boundaryAlien, alienComparator)
    :
      boundaryAlien
  }

  function latChange(inpBody: Body, horiChange: number): number {    
    const 
      leftExceeded = inpBody.xPos + horiChange <= P_LEFT_BOUND,
      rightExceeded = inpBody.xPos + horiChange >= P_RIGHT_BOUND,
      leftStartPos = P_LEFT_BOUND + (inpBody.xPos + horiChange) - P_RIGHT_BOUND,
      rightStartPos = CANVAS_WIDTH - (inpBody.xPos + PLAYER_WIDTH),
      adjLateralPos = leftExceeded ? rightStartPos : rightExceeded ? leftStartPos : inpBody.xPos + horiChange

    return adjLateralPos
  }

  function createShield(inpShieldBody: Body): Shield {
    return {shieldBody: inpShieldBody,
      shieldHits: []}
  }

  function createBody(curState: State, inpXPos: number, inpYPos: number, inpWidth: number, inpHeight: number, fallBackId: number): Body {

    // Inspired by Tim Dwyer's Astroid implementation
    
    // fallBack argument is used for Player and Alien Body instantiations - initState is null at that time

    return {
      bodyId: curState ? curState.idSequence : fallBackId,
      xPos: inpXPos,
      yPos: inpYPos,
      bodyWidth: inpWidth,
      bodyHeight: inpHeight
    }
  }

  function moveShot(inpBody: Body, yInc: number): Body {
    return {...inpBody, yPos: inpBody.yPos - yInc}
  }

  function updateScreen(curState: State): void {

    // Inspired by Tim Dwyer's Astroid implementation

    const uncreatedPredicate = (aBody: Body) => !document.getElementById(String(aBody.bodyId)),
          uncreatedPShots = curState.activePShots.filter(uncreatedPredicate),
          uncreatedEShots = curState.activeEShots.filter(uncreatedPredicate),
          createdPShots = curState.activePShots.filter(aShot => !uncreatedPShots.includes(aShot)),
          createdEShots = curState.activeEShots.filter(aShot => !uncreatedEShots.includes(aShot)),
          aliveAliens = curState.activeAliens.map(alienList => alienList.filter(NOT_NULL))

    // Update the current score of the game

    GAME_SCORE.innerHTML = `Score | ${curState.gameScore}`

    // Update the number of lives that the player has

    PLAYER_LIVES.innerHTML = `Lives | ${curState.playerLives}`
    
    // Update the position of the player visually

    document.getElementById("player")!.setAttribute("transform", `translate(${curState.statePlayer.xPos}, 525)`)

    // Create the uncreated 'shot' element(s) on the document 

    uncreatedPShots.forEach(shotBody => createElement(shotBody, "white", 10))
    uncreatedEShots.forEach(shotBody => createElement(shotBody, "white", -5, SHOT_GROUP))

    // Update the position of created shot element(s)

    createdPShots.forEach(updateElement)
    createdEShots.forEach(updateElement)

    // Update the positon of alive 'alien' element(s) with wait times 

    aliveAliens.forEach(alienList => alienList.forEach(updateElement))

    // Remove the Shots that have 'expired'

    curState.expiredPShots.forEach(pShot => removeElement(pShot))
    curState.expiredEShots.forEach(eShot => removeElement(eShot, SHOT_GROUP))

    // Check if the game has ended

    curState.gameOver ? 
      gameOverRoutine()
    :
      null 
  }

  function gameOverRoutine() {
    obsSubscription.unsubscribe()

    // Display the game over text

    displayText("Game Over")
  }

  function displayText(inpText: string) {
    const
      displayTextElement = document.createElementNS(SVG_CANVAS.namespaceURI, "text")!

    displayTextElement.setAttribute("x", String(CANVAS_WIDTH / 3))
    displayTextElement.setAttribute("y", String(CANVAS_HEIGHT / 2))
    displayTextElement.setAttribute("font-family", "niceFont")
    displayTextElement.setAttribute("font-size", "40")
    displayTextElement.setAttribute("fill", "white")
    displayTextElement.innerHTML = inpText

    SVG_CANVAS.appendChild(displayTextElement)
  }

  function removeElement(inpBody: Body, parentNode: Element = SVG_CANVAS): void {
    const inpElement = document.getElementById(String(inpBody.bodyId))

    if (inpElement) {
      parentNode.removeChild(inpElement)
    }
  }

  function createElement(elementBody: Body, elementColour: string, yInc: number = 0, parentNode: Element = SVG_CANVAS, prePend: boolean = false): void {
    const 
      createdElement = document.createElementNS(SVG_CANVAS.namespaceURI, "rect")!

    createdElement.setAttribute("style", `fill: ${elementColour}`)
    createdElement.setAttribute("width", String(elementBody.bodyWidth))
    createdElement.setAttribute("height", String(elementBody.bodyHeight))
    createdElement.setAttribute("id", String(elementBody.bodyId))
    createdElement.setAttribute("transform", `translate(${elementBody.xPos}, ${elementBody.yPos - yInc})`)

    prePend ? 
      parentNode.before(createdElement)
    :
      parentNode.appendChild(createdElement)
  }

  function updateElement(inpBody: Body): void {
    const 
      inpElement = document.getElementById(String(inpBody.bodyId))

    // null check for reset of Aliens

    if (inpElement) {
      inpElement.setAttribute("transform", `translate(${inpBody.xPos}, ${inpBody.yPos})`)
    }
  }

  function cartesianProduct(addedBody: Body | Shield, bodyArray: ReadonlyArray<Body>): ReadonlyArray<ReadonlyArray<Body | Shield>> {
    return bodyArray.map(subBody => [subBody, addedBody])
  }

  function handleCollisions(curState: State): State {

    // Inspired by Tim Dwyer's Astroid implementation

    // Determine all the collided Bodies

    const 
      bodiesCollided = ([bOne, bTwo]) => collisionCheck(bOne, bTwo),
      checkTruth = (accBoo: boolean, curBoo: boolean) => accBoo || curBoo,
      shieldSubmerge = ([eBody, sBody]) => collisionFormula([eBody.xPos, eBody.yPos], [sBody.xPos, sBody.yPos], sBody.bodyHeight, sBody.bodyWidth),
      notNullAliens = curState.activeAliens.map(subAlienList => subAlienList.filter(NOT_NULL)),
      allAliensAndShots = flatMap(curState.activePShots.map(aShot => cartesianProduct(aShot, flatMap(notNullAliens, I_COMB))), I_COMB),
      allShotsAndShots = flatMap(curState.activePShots.map(aShot => cartesianProduct(aShot, curState.activeEShots)), I_COMB),
      allPShotsAndShields = flatMap(curState.gameShields.map(aShield => cartesianProduct(aShield, curState.activePShots)), I_COMB),
      allEShotsAndShields = flatMap(curState.gameShields.map(aShield => cartesianProduct(aShield, curState.activeEShots)), I_COMB),
      allAliensAndShields = flatMap(notNullAliens.map(alienList => curState.gameShields.map(aShield => cartesianProduct(aShield, alienList))), I_COMB)

    const 
      collidedAliensAndShots = allAliensAndShots.filter(bodiesCollided),
      collidedAliens = collidedAliensAndShots.map(([alienBody, _]) => alienBody),
      collidedPShots = collidedAliensAndShots.map(([_, shotBody]) => shotBody),
      collidedEShotsOnPlayer = curState.activeEShots.filter(shotBody => bodiesCollided([curState.statePlayer, shotBody])),
      collidedShotsAndShots = allShotsAndShots.filter(bodiesCollided),
      collidedPShotsOnShields = allPShotsAndShields.filter(([aShot, aShield]) => bodiesCollided([aShot, aShield.shieldBody])).map(([pShot, _]) => pShot),
      fCollidedAliensAndShields = flatMap(allAliensAndShields.map(subList  => subList.filter(([anAlien, aShield]) => shieldSubmerge([anAlien, aShield.shieldBody]))), I_COMB).filter(duoList => duoList.length > 0),
      pCollidedAliensAndShields = allAliensAndShields.map(subList => subList.filter(([anAlien, aShield]) => shieldSubmerge([aShield.shieldBody, anAlien]))).filter(duoList => duoList.length > 0),
      
      // Check for Shots that the Shield(s) have never experinced 

      collidedEShotsAndShields = allEShotsAndShields.filter(([aShot, aShield]) => bodiesCollided([aShot, aShield.shieldBody])).filter((subList: [Body, Shield]) => !checkPrevShieldHit(subList)),
      collidedEShotsOnShields = collidedEShotsAndShields.map(([colShot, _]) => colShot)

    // Determine all the non-collided alien(s) and shot(s)

    const
      aliveAliens = curState.activeAliens.map(subAlienList => subAlienList.map(subAlien => checkMembership(subAlien, collidedAliens))),
      activePShots = curState.activePShots.filter(aShot => !collidedPShots.includes(aShot) && !collidedPShotsOnShields.includes(aShot)),
      activeEShots = curState.activeEShots.filter(aShot => !collidedEShotsOnPlayer.includes(aShot) && !collidedEShotsOnShields.includes(aShot))

    // Remove all collided alien(s) and shot(s) from the document

    collidedAliens.forEach((eBody: Body) => removeElement(eBody))
    collidedPShots.forEach((pShot: Body) => removeElement(pShot))

    collidedEShotsOnPlayer.forEach((eShot: Body) => removeElement(eShot, SHOT_GROUP))

    // Remove all Shots that have collided with other Shots

    collidedShotsAndShots.forEach(removeCollidedShots)

    // Refill all active shields to light-green

    curState.gameShields.forEach(aShield => altElementColour(String(aShield.shieldBody.bodyId), "#00ff00"))

    // Mark all of the Shields that have partially collided with the Aliens(s) with a darker shade of green

    pCollidedAliensAndShields.forEach(subList => subList.forEach(([_, aShield]) => altElementColour(String(aShield.shieldBody.bodyId), "#00b300")))

    // Remove all of the Player's shots that have collided with Shield(s)

    collidedPShotsOnShields.forEach(pShot => removeElement(pShot))

    // Mark all Alien shots that have collided with the Shield(s)

    collidedEShotsOnShields.forEach((aShot: Body) => altElementColour(String(aShot.bodyId), "#292924"))

    // Add the coordinates of the Shot(s) that have collided with a Shield for future disregard

    const
      markedShields = collidedEShotsAndShields.map(([colShot, colShield]) => addShotCoord(colShield, colShot)).reverse(),

      // Remove duplicates and fully covered shields from markedShields

      filteredShields = filterShieldList(markedShields).filter(aShield => !(fCollidedAliensAndShields.map(([_, cShield]) => cShield).includes(aShield))),

      // Determine the shields that have not been fully covered

      availShields = curState.gameShields.filter(aShield => !(fCollidedAliensAndShields.map(([_, cShield]) => cShield).includes(aShield))),

      // Determine the shields that have been fully covered

      notAvailShields = curState.gameShields.filter(aShield => !availShields.includes(aShield)),

      // Update the score of the game

      updatedScore = curState.gameScore + ((getAlienCount(curState.activeAliens) - getAlienCount(aliveAliens)) * 10),

      // Check if an Alien has exceeded the screen

      exceededScreen = notNullAliens.filter(subList => subList.length > 0).map(subList => subList.map(subAlien => subAlien.yPos > CANVAS_HEIGHT).reduce(checkTruth), false).reduce(checkTruth, false)

    // Remove all fully collided shields

    notAvailShields.filter(subShield => subShield != undefined).forEach(aShield => removeElement(aShield.shieldBody))

    // Change the colour of the player if it has been hit

    const
      playerColour =
        collidedEShotsOnPlayer.length > 0 ?
          curState.playerLives == 3 ?
            TWO_LIVES_COLOUR
          :
          curState.playerLives == 2 ?
            ONE_LIFE_COLOUR
          :
            DEAD_COLOUR
        :
          null
          
    collidedEShotsOnPlayer.length > 0 ?
      altElementColour("player", playerColour)
    :
      null

    // Shields can be hit multiple times at once - ensure that the most up-to-date shield is included
    
    return {...curState, 
      activeAliens: aliveAliens,
      activePShots: activePShots,
      activeEShots: activeEShots,
      gameShields: filterShieldList(availShields.concat(filteredShields).reverse()),
      gameScore: updatedScore,
      playerLives: curState.playerLives - collidedEShotsOnPlayer.length,
      gameOver: exceededScreen || curState.playerLives - collidedEShotsOnPlayer.length == 0
    }
  }

  function getAlienCount(twoDAlienList: ReadonlyArray<ReadonlyArray<Body>>) {
    return twoDAlienList.map(subAlienList => subAlienList.filter(NOT_NULL)).reduce((accLength, subList) => accLength + subList.length, 0)
  }

  function removeCollidedShots(shotList: ReadonlyArray<Body>) {

    // An Alien's Shot is at index - and a Player's Shot is at index 1

    shotList[0] ?
      removeElement(shotList[0], SHOT_GROUP)
    :
      null

    shotList[1] ? 
      removeElement(shotList[1])
    :
      null
  }

  function checkPrevShieldHit(subList: [Body, Shield]) {

    // Check if a Shot has previsouly been on the Shield

    return subList[1].shieldHits.length > 0 ?
            subList[1].shieldHits.map((aHitList) => subList[0].xPos == aHitList[0] && subList[0].yPos == aHitList[1]).reduce((accBool, curBool) => accBool || curBool, false)
          :
            false
  }

  function filterShieldList(shieldList: ReadonlyArray<Shield>) {

    // shieldList has been pre-reversed

    return shieldList.filter((subShield: Shield, curIndex: number) => shieldList.findIndex((aShield: Shield) => subShield.shieldBody.bodyId == aShield.shieldBody.bodyId) == curIndex)
  }

  function addShotCoord(inpShield: Shield, inpShot: Body): Shield {
    return {...inpShield,
      shieldHits: inpShield.shieldHits.concat([[inpShot.xPos, inpShot.yPos]])}
  }

  function altElementColour(elementId: string, altColour: string) {
    const
      inpElement = document.getElementById(elementId)

    if (inpElement) {
      inpElement.setAttribute("style", `fill: ${altColour}`)
    }
  }

  function checkMembership(inpAlien: Body, collidedAliens: ReadonlyArray<Body>): Body {
    return inpAlien ? collidedAliens.includes(inpAlien) ? null : inpAlien : null
  }

  function collisionCheck(bodyOne: Body, bodyTwo: Body): boolean {
    const
      bodyOneList = [bodyOne.xPos, bodyOne.yPos],
      bodyTwoList = [bodyTwo.xPos, bodyTwo.yPos]


    // Check if either Body has collided with the other

    return collisionFormula(bodyOneList, bodyTwoList, bodyTwo.bodyHeight, bodyTwo.bodyWidth) || 
           collisionFormula(bodyTwoList, bodyOneList, bodyOne.bodyHeight, bodyOne.bodyWidth)
  }

  function collisionFormula(posListOne: ReadonlyArray<number>, posListTwo: ReadonlyArray<number>, twoHeight: number, twoWidth: number): boolean {

     // Check if two bodies have collided

     /* (bOne.yPos > bTwo.yPos && bOne.yPos < bTwo.yPos + bTwo.bodyHeight) &&
        (bOne.xPos > bTwo.xPos && bOne.xPos < bTwo.xPos + bTwo.bodyWidth) */

    return (posListOne[1] > posListTwo[1] && posListOne[1] < posListTwo[1] + twoHeight) &&
           (posListOne[0] > posListTwo[0] && posListOne[0] < posListTwo[0] + twoWidth)
  }

  const
    obsSubscription =
      interval(10)
      .pipe(
        merge(
          startLeftStep,
          startRightStep,
          stopLeftStep,
          stopRightStep,
          startShoot
        ),
        scan(reduceState, initState)
      ).subscribe(updateScreen)
}
  
if (typeof window != 'undefined')
  window.onload = ()=>{
    spaceinvaders();
  }
