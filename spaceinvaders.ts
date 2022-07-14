import { fromEvent, interval } from 'rxjs'; 
import { map, filter, scan, merge } from 'rxjs/operators';

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

function createShield(inpShieldBody: Body): Shield {
  return {shieldBody: inpShieldBody, shieldHits: []}
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

function spaceinvaders() {  
  const 
    notNull = <T>(subValue: T) => subValue != null,
    playerId = 0,
    playerEleId = "player",
    pShotWidth = 2,
    pShotHeight = 15,
    eShotWidth = 3,
    eShotHeight = 35,
    shieldWidth = 80,
    shieldHeight = 50,
    twoLivesColour = "#000099",
    oneLifeColour = "#00004d",
    deadColour = "#292924",
    shieldColour = "#00ff00",
    touchedShieldColour = "#00b300",
    enemyColour = "#ff0000",
    shotColour = "#ffffff",
    svgCanvas = document.getElementById("canvas")!,
    shotGroup = document.getElementById("shotGroup"),
    gameScore = document.getElementById("gameScore")!,
    playerLives = document.getElementById("playerLives")!,
    canvasWidth = Number(document.getElementById("canvas").getAttribute("width")),
    canvasHeight = Number(document.getElementById("canvas").getAttribute("height")),
    playerEle = document.getElementById("player")!,
    playerWidth = Number(playerEle.getAttribute("width")),
    playerHeight = Number(playerEle.getAttribute("height")),
    canvasLeftBound = 0,
    canvasRightBound = 560,
    playerLeftBound = -playerWidth,
    playerRightBound = canvasWidth + playerWidth,

    initState: State = { 
      statePlayer: createBody(null, 280, 535, playerWidth, playerHeight, playerId),
      activePShots: [],
      expiredPShots: [],
      activeAliens: createAliens(),
      activeEShots: [],
      expiredEShots: [],
      bottomAliens: null,
      leftMostAlien: null,
      rightMostAlien: null,
      gameShields: [createBody(null, 50, 425, shieldWidth, shieldHeight, 1), createBody(null, 190, 425, shieldWidth, shieldHeight, 2), createBody(null, 330, 425, shieldWidth, shieldHeight, 3), createBody(null, 470, 425, shieldWidth, shieldHeight, 4)].map(createShield),
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
    startShoot = observeKey('keydown', 'Space', false, () => new Shoot(true))
    
  // Create the shield elements onto the screen

  initState.gameShields.forEach(gameShield => createElement(gameShield.shieldBody, shieldColour, 0, shotGroup, true))

  // Create the uncreated 'Alien' elements onto the document
  
  setAliens(initState)

  function setAliens(curState: State) {
    curState.activeAliens.flat().forEach((subBody: Body) => createElement(subBody, enemyColour))
  }

  function createAliens() {
    return [0, 1, 2].map(yInc => createAlienCoords(0, yInc, []).map((cordList: ReadonlyArray<number>) => createBody(null, cordList[0], cordList[1], playerWidth, playerHeight, Number(String(cordList[0]) + String(cordList[1])))))
  }

  function createPShotBody(curState: State): Body {

    // xPos centers the Shot between the Player, yPos elevates the Shot above the Player

    const 
      xPos = curState.statePlayer.xPos + playerWidth / 2 - pShotWidth / 2,
      yPos = curState.statePlayer.yPos - 5

    return createBody(curState, xPos, yPos, pShotWidth, pShotHeight, null)
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

    return inpBody ? e instanceof Step ? 
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

    if (curState.resetAliens) {
      setAliens(curState)
    }

    // Check if all Aliens have been defeated

    const
      nextRound = curState.activeAliens.flat().filter(notNull).length == 0
    
    // Player's position is updated in this function

    const updatedState 
      = e instanceof Step ? {...curState, 
          statePlayer: moveBody(curState.statePlayer, e)
        } : 
                        
        // Invoke a shooting threshold of 2 active shots - visible on the screen

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
    const 
      closestAlien = detClosedAlien(curState.bottomAliens.slice(1), curState.bottomAliens[0], curState.statePlayer.xPos)

    const 
      shotChance = Math.floor(Math.random() * 100),
      xPos = closestAlien ? closestAlien.xPos + closestAlien.bodyWidth / 2 - eShotWidth / 2 : null,
      yPos = closestAlien ? closestAlien.yPos + closestAlien.bodyHeight : null

    // There is a 1% chance for an Alien to shoot

    return shotChance <= 1 ? closestAlien ? createBody(curState, xPos, yPos, eShotWidth, eShotHeight, null) : null : null
  }

  function incrementId(inpState: State): State {
    return {...inpState, idSequence: inpState.idSequence + 1}
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
      eShotPredicate = (shotBody: Body) => (shotBody.yPos > canvasHeight),
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
                          curState.leftMostAlien.xPos <= canvasLeftBound || curState.rightMostAlien.xPos >= canvasRightBound 
                        : null
                      : null

    // Determine the move that Alien bodies should make

    return exceededBound ? [0, 2.5] : [curState.emenyLatDirection, 0] 
  }

  function resetBottomAliens(alienList: ReadonlyArray<ReadonlyArray<Body>>, accBottomList = [], curInd = 0): ReadonlyArray<Body> {
    return curInd == 9 ? accBottomList : resetBottomAliens(alienList, accBottomList.concat(getBottomAlien(alienList, curInd)), curInd + 1)
  } 

  function getBottomAlien(alienList: ReadonlyArray<ReadonlyArray<Body>>, colInd: number, bottomAlien: Body = null, rowInd: number = 0): Body {
    const 
      subAlien = alienList[rowInd][colInd],
      propAlien = subAlien ? subAlien : bottomAlien

    return rowInd == 2 ? propAlien : getBottomAlien(alienList, colInd, propAlien, rowInd + 1) 
  } 

  function resetAlienBoundaries(curState: State): State {
    const
      enemyList = curState.activeAliens.flat(),
      lMostAlien = findBoundary(enemyList.slice(1), enemyList[0], "<"),
      rMostAlien = findBoundary(enemyList.slice(1), enemyList[0], ">")

    return {
      ...curState,
      leftMostAlien: lMostAlien,
      rightMostAlien: rMostAlien
    }
  }

  function findBoundary(alienList: ReadonlyArray<Body>, boundaryAlien: Body, alienComparator: String): Body {    

    // Determines the left or rightmost enemy Body

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
      leftExceeded = inpBody.xPos + horiChange <= playerLeftBound,
      rightExceeded = inpBody.xPos + horiChange >= playerRightBound,
      leftStartPos = playerLeftBound + (inpBody.xPos + horiChange) - playerRightBound,
      rightStartPos = canvasWidth - (inpBody.xPos + playerWidth),
      adjLateralPos = leftExceeded ? rightStartPos : rightExceeded ? leftStartPos : inpBody.xPos + horiChange

    return adjLateralPos
  }

  function moveShot(inpBody: Body, yInc: number): Body {
    return {...inpBody, yPos: inpBody.yPos - yInc}
  }

  function updateScreen(curState: State): void {

    // Inspired by Tim Dwyer's Astroid implementation

    const 
      uncreatedPredicate = (aBody: Body) => !document.getElementById(String(aBody.bodyId)),
      uncreatedPShots = curState.activePShots.filter(uncreatedPredicate),
      uncreatedEShots = curState.activeEShots.filter(uncreatedPredicate),
      createdPShots = curState.activePShots.filter(aShot => !uncreatedPShots.includes(aShot)),
      createdEShots = curState.activeEShots.filter(aShot => !uncreatedEShots.includes(aShot)),
      aliveAliens = curState.activeAliens.map(alienList => alienList.filter(notNull))

    // Update the current score of the game

    gameScore.innerHTML = `Score | ${curState.gameScore}`

    // Update the number of lives that the player has

    playerLives.innerHTML = `Lives | ${curState.playerLives}`
    
    // Update the position of the player visually

    document.getElementById("player")!.setAttribute("transform", `translate(${curState.statePlayer.xPos}, 525)`)

    // Create the uncreated 'shot' element(s) on the document 

    uncreatedPShots.forEach(shotBody => createElement(shotBody, shotColour, 10))
    uncreatedEShots.forEach(shotBody => createElement(shotBody, shotColour, -5, shotGroup))

    // Update the position of created shot element(s)

    createdPShots.forEach(updateElement)
    createdEShots.forEach(updateElement)

    // Update the positon of alive 'alien' element(s) with wait times 

    aliveAliens.forEach(alienList => alienList.forEach(updateElement))

    // Remove the Shots that have 'expired'

    curState.expiredPShots.forEach(pShot => removeElement(pShot))
    curState.expiredEShots.forEach(eShot => removeElement(eShot, shotGroup))

    // Check if the game has ended

    if (curState.gameOver) {
      gameOverRoutine()
    }
  }

  function gameOverRoutine() {
    obsSubscription.unsubscribe()

    // Display the game over text

    displayText("Game Over")
  }

  function displayText(inpText: string) {
    const
      displayTextElement = document.createElementNS(svgCanvas.namespaceURI, "text")!

    displayTextElement.setAttribute("x", String(canvasWidth / 3))
    displayTextElement.setAttribute("y", String(canvasHeight / 2))
    displayTextElement.setAttribute("font-family", "niceFont")
    displayTextElement.setAttribute("font-size", "40")
    displayTextElement.setAttribute("fill", "white")
    displayTextElement.innerHTML = inpText

    svgCanvas.appendChild(displayTextElement)
  }

  function removeElement(inpBody: Body, parentNode: Element = svgCanvas): void {
    const 
      inpElement = document.getElementById(String(inpBody.bodyId))

    if (inpElement) {
      parentNode.removeChild(inpElement)
    }
  }

  function createElement(elementBody: Body, elementColour: string, yInc: number = 0, parentNode: Element = svgCanvas, prePend: boolean = false): void {
    const 
      createdElement = document.createElementNS(svgCanvas.namespaceURI, "rect")!

    createdElement.setAttribute("style", `fill: ${elementColour}`)
    createdElement.setAttribute("width", String(elementBody.bodyWidth))
    createdElement.setAttribute("height", String(elementBody.bodyHeight))
    createdElement.setAttribute("id", String(elementBody.bodyId))
    createdElement.setAttribute("transform", `translate(${elementBody.xPos}, ${elementBody.yPos - yInc})`) 

    if (prePend) {
      parentNode.before(createdElement)
    }
    
    else {
      parentNode.appendChild(createdElement)
    }
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
      notNullAliens = curState.activeAliens.map(subAlienList => subAlienList.filter(notNull)),
      allAliensAndShots = curState.activePShots.map(aShot => cartesianProduct(aShot, notNullAliens.flat())).flat(),
      allShotsAndShots = curState.activePShots.map(aShot => cartesianProduct(aShot, curState.activeEShots)).flat(),
      allPShotsAndShields = curState.gameShields.map(aShield => cartesianProduct(aShield, curState.activePShots)).flat(),
      allEShotsAndShields = curState.gameShields.map(aShield => cartesianProduct(aShield, curState.activeEShots)).flat(),
      allAliensAndShields = notNullAliens.map(alienList => curState.gameShields.map(aShield => cartesianProduct(aShield, alienList))).flat()

    const 
      collidedAliensAndShots = allAliensAndShots.filter(bodiesCollided),
      collidedAliens = collidedAliensAndShots.map(([alienBody, _]: [Body, Body]) => alienBody),
      collidedPShots = collidedAliensAndShots.map(([_, shotBody]) => shotBody),
      collidedEShotsOnPlayer = curState.activeEShots.filter(shotBody => bodiesCollided([curState.statePlayer, shotBody])),
      collidedShotsAndShots = allShotsAndShots.filter(bodiesCollided),
      collidedPShotsOnShields = allPShotsAndShields.filter(([aShot, aShield]: [Body, Shield]) => bodiesCollided([aShot, aShield.shieldBody])).map(([pShot, _]) => pShot),
      fCollidedAliensAndShields = allAliensAndShields.map(subList => subList.filter(([anAlien, aShield]: [Body, Shield]) => shieldSubmerge([anAlien, aShield.shieldBody]))).flat().filter(duoList => duoList.length > 0),
      pCollidedAliensAndShields = allAliensAndShields.map(subList => subList.filter(([anAlien, aShield]: [Body, Shield]) => shieldSubmerge([aShield.shieldBody, anAlien]))).filter(duoList => duoList.length > 0),
      
      // Check for Shots that the Shield(s) have never experinced 

      collidedEShotsAndShields = allEShotsAndShields.filter(([aShot, aShield]: [Body, Shield]) => bodiesCollided([aShot, aShield.shieldBody])).filter((subList: [Body, Shield]) => !checkPrevShieldHit(subList)),
      collidedEShotsOnShields = collidedEShotsAndShields.map(([colShot, _]) => colShot)

    // Determine all the non-collided alien(s) and shot(s)

    const
      aliveAliens = curState.activeAliens.map(subAlienList => subAlienList.map(subAlien => checkMembership(subAlien, collidedAliens))),
      activePShots = curState.activePShots.filter(aShot => !collidedPShots.includes(aShot) && !collidedPShotsOnShields.includes(aShot)),
      activeEShots = curState.activeEShots.filter(aShot => !collidedEShotsOnPlayer.includes(aShot) && !collidedEShotsOnShields.includes(aShot))

    // Remove all collided alien(s) and shot(s) from the document

    collidedAliens.forEach((eBody: Body) => removeElement(eBody))
    collidedPShots.forEach((pShot: Body) => removeElement(pShot))

    collidedEShotsOnPlayer.forEach((eShot: Body) => removeElement(eShot, shotGroup))

    // Remove all Shots that have collided with other Shots

    collidedShotsAndShots.forEach(removeCollidedShots)

    // Refill all active shields to light-green

    curState.gameShields.forEach(aShield => altElementColour(String(aShield.shieldBody.bodyId), shieldColour))

    // Mark all of the Shields that have partially collided with the Aliens(s) with a darker shade of green

    pCollidedAliensAndShields.forEach(subList => subList.forEach(([_, aShield]: [Body, Shield]) => altElementColour(String(aShield.shieldBody.bodyId), touchedShieldColour)))

    // Remove all of the Player's shots that have collided with Shield(s)

    collidedPShotsOnShields.forEach((pShot: Body) => removeElement(pShot))

    // Mark all Alien shots that have collided with the Shield(s)

    collidedEShotsOnShields.forEach((aShot: Body) => altElementColour(String(aShot.bodyId), deadColour))

    // Add the coordinates of the Shot(s) that have collided with a Shield for future disregard

    const
      markedShields = collidedEShotsAndShields.map(([colShot, colShield]: [Body, Shield]) => addShotCoord(colShield, colShot)).reverse(),

      // Remove duplicates and fully covered shields from markedShields

      filteredShields = filterShieldList(markedShields).filter(aShield => !(fCollidedAliensAndShields.map(([_, cShield]) => cShield).includes(aShield))),

      // Determine the shields that have not been fully covered

      availShields = curState.gameShields.filter(aShield => !(fCollidedAliensAndShields.map(([_, cShield]) => cShield).includes(aShield))),

      // Determine the shields that have been fully covered

      notAvailShields = curState.gameShields.filter(aShield => !availShields.includes(aShield)),

      // Update the score of the game

      updatedScore = curState.gameScore + ((getAlienCount(curState.activeAliens) - getAlienCount(aliveAliens)) * 10),

      // Check if an Alien has exceeded the screen

      exceededScreen = notNullAliens.filter(subList => subList.length > 0).map(subList => subList.map(subAlien => subAlien.yPos > canvasHeight).reduce(checkTruth), false).reduce(checkTruth, false)

    // Remove all fully collided shields

    notAvailShields.filter(subShield => subShield != undefined).forEach(aShield => removeElement(aShield.shieldBody))

    // Change the colour of the player if it has been hit
          
    if (collidedEShotsOnPlayer.length > 0) {
      const 
        playerColour = curState.playerLives == 3 ? twoLivesColour : curState.playerLives == 2 ? oneLifeColour : deadColour

      altElementColour(playerEleId, playerColour)
    }

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
    return twoDAlienList.map(subAlienList => subAlienList.filter(notNull)).reduce((accLength, subList) => accLength + subList.length, 0)
  }

  function removeCollidedShots(shotList: ReadonlyArray<Body>) {

    // An Alien's Shot is at index 0 and a Player's Shot is at index 1

    if (shotList[0]) {
      removeElement(shotList[0], shotGroup)
    }

    if (shotList[1]) {
      removeElement(shotList[1])
    }
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
    return {...inpShield, shieldHits: inpShield.shieldHits.concat([[inpShot.xPos, inpShot.yPos]])}
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
  window.onload = () => {
    spaceinvaders();
  }