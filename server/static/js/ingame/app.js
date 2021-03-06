function lockInAction(element, icon, action, index) {
    let middleIcon = element.parentElement.getElementsByClassName('action-display')[0];
    middleIcon.classList.add(icon);
    middleIcon.classList.remove('fa-plus');

    let checkBox = element.parentElement.getElementsByClassName('menu-open')[0];
    checkBox.disabled = true;
    checkBox.checked = false;

    let menuOpenButton = element.parentElement.getElementsByClassName('menu-open-button')[0];
    menuOpenButton.style.background = "green";
    game_socket.emit('lockInOrder', action, gameRoom, index);

    if (document.getElementsByClassName('fa-plus').length === 0) game_socket.emit('allOrdersAreSet', gameRoom, playerName);
}

function removeOnClickEvent(element) {
    element.onclick = null;
    element.removeAttribute("onclick");
}

function calculateStrength(elements) {
    let strength = 0;
    for (let i = 0; i < elements.length; i++)
        strength += parseInt(elements[i].getElementsByTagName('text')[0].innerHTML);
    return strength;
}

function calculateSelectedStrength(elements) {
    let strength = 0;
    for (let i = 0; i < elements.length; i++) {
        if (elements[i].childNodes[0].classList.contains("selected")) {
            strength += parseInt(elements[i].getElementsByTagName('text')[0].innerHTML);
        }
    }
    return strength;
}

function highlightMoveOptions(index, turnOn) {
    let allTileElements = document.getElementsByClassName('hex');
    let neighbouringTiles = index % 2 ? [-1, +1, -24, 23, 24, 25] : [-1, +1, -23, -24, -25, 24];

    for (let i = 0; i < neighbouringTiles.length; i++) {
        let hex = allTileElements[index + neighbouringTiles[i]];
        if (hex.className !== "hex water") {
            if (turnOn) {
                hex.classList.add("highlight");
                hex.onclick = moveSelectUnits;
            } else {
                hex.classList.remove("highlight");
                removeOnClickEvent(hex);
            }
        }
    }
}

function highlightDeploymentOptions(race, turnOn, infantry, ranged, tank) {
    let allTileElements = document.getElementsByClassName('hex');
    let allRaceEntries = document.getElementsByClassName(race);

    let raceTilesToCheckForHighLighting = [];
    //Convert collection of elements into array
    allRaceEntries = [].slice.call(allRaceEntries);
    allRaceEntries.forEach(function (entry) {
        let tileIndex = getIndexValue(entry.parentElement.parentElement);
        if (raceTilesToCheckForHighLighting.indexOf(tileIndex) === -1) {
            raceTilesToCheckForHighLighting.push(tileIndex);
        }
    });

    raceTilesToCheckForHighLighting.forEach(function (index) {
        let neighbouringTiles = index % 2 ? [0, -1, +1, -24, 23, 24, 25] : [0, -1, +1, -23, -24, -25, 24];
        for (let i = 0; i < neighbouringTiles.length; i++) {
            let neighbouringTilesIndex = index + neighbouringTiles[i];
            let hex = allTileElements[neighbouringTilesIndex];

            let neutralTile = true;
            if (hex.childNodes[0].childElementCount > 0) {
                neutralTile = hex.childNodes[0].childNodes[0].childNodes[0].classList.contains(race);
            }

            if (hex.className !== "hex water" && neutralTile) {
                if (turnOn) {
                    hex.classList.add("highlight");
                    hex.onclick = function () {
                        targetIndex = getIndexByHex(hex);
                        game_socket.emit('deploymentOfUnits', gameRoom, {
                            "index":targetIndex,
                            "race": getPlayersRace(),
                            "infantry": infantry,
                            "ranged": ranged,
                            "tanks": tank
                        });
                        highlightDeploymentOptions(race, false);
                    };
                } else {
                    hex.classList.remove("highlight");
                    removeOnClickEvent(hex);
                }
            }
        }
    });
}

function handleMoveAction(index, movementAction, turnOn) {

    //Enable move options
    highlightMoveOptions(index, turnOn);

    movementAction.parentElement.parentElement.childNodes[0].disbled = turnOn;

    let unitList = movementAction.parentElement.parentElement.getElementsByTagName('g');
    for (let i = 0; i < unitList.length; i++) {
        let svgElement = unitList[i];
        if (turnOn) {
            svgElement.onclick = markAsSelected;
        } else {
            removeOnClickEvent(svgElement);
        }
    }

    function markAsSelected() {
        this.childNodes[0].classList.add("selected");
        let classList = this.childNodes[0].classList;
        let units_index = getIndexValue(this.childNodes[0].parentElement.parentElement);
        if (classList !== null) {
            game_socket.emit('markUnitAsSelected', gameRoom, classList, units_index);
        }
    }
}

function activateMoveToken(data) {
    let raceToEnableTokenFor = data.raceToEnableTokenFor;
    let tileIndex = data.tileIndex;

    if (raceToEnableTokenFor === getPlayersRace()) {

        let tileElement = document.getElementById(getHexIdByIndex(tileIndex));
        let menuElement = tileElement.childNodes[0].childNodes[1];
        menuElement.classList.add('ACTIVE');

        handleMoveAction(tileIndex, menuElement, true);

        menuElement.onclick = function () {
            handleMoveAction(tileIndex, menuElement, false);
            removeActionMenu(menuElement.parentElement);
            game_socket.emit('movementCompleteForTile', gameRoom, tileIndex);
        }
    }
}

function enableMoveActions(raceToEnableMovesFor, playersRace) {

    if (raceToEnableMovesFor === playersRace) {
        let listOfMoves = document.getElementsByClassName('action-display fa-arrow-right');
        for (let i = 0; i < listOfMoves.length; i++) {
            let movementAction = listOfMoves[i];
            movementAction.parentElement.style.background = 'orange';
            movementAction.parentElement.onclick = function () {

                let activeTileInputTag = this.parentElement.getElementsByTagName('input')[0];
                let index = parseInt(activeTileInputTag.attributes.name.value.replace("menu-open", ""));
                //Reset tiles
                for (let i = 0; i < listOfMoves.length; i++) {
                    listOfMoves[i].parentElement.style.background = 'green';
                    removeOnClickEvent(listOfMoves[i].parentElement);
                }
                game_socket.emit('activateMovementToken', gameRoom, playersRace, index);
            };
        }
    }
}

function moveSelectUnits() {
    let originIndex = getIndexValue(document.getElementsByClassName('ACTIVE')[0].parentElement.parentElement.childNodes[1]);
    let targetIndex = getIndexValue(this.childNodes[0]);
    game_socket.emit('resolveMovement', gameRoom, originIndex, targetIndex);
}

function getParentsFor(elements) {
    let arrayOfParents = [];
    for (let i = 0; i < elements.length; i++) {
        arrayOfParents.push(elements[i].parentElement);
    }
    return arrayOfParents;
}

function resolveBattleMovement(targetTile, selectedUnitsShapesToMove) {

    let attackingUnitsSvgElement = selectedUnitsShapesToMove[0].parentElement.parentElement;
    let defendingUnitsSvgElement = targetTile[0].parentElement.getElementsByTagName('svg')[0];

    let arrayOfAttackingUnits = getParentsFor(selectedUnitsShapesToMove);
    let arrayOfDefendingUnits = defendingUnitsSvgElement.getElementsByTagName('g');

    let defStr = calculateStrength(arrayOfDefendingUnits);
    let atkStr = calculateSelectedStrength(attackingUnitsSvgElement.childNodes);

    if (defStr > atkStr) {
        defenderWins(arrayOfAttackingUnits, attackingUnitsSvgElement, arrayOfDefendingUnits, defendingUnitsSvgElement, atkStr);
    } else if (defStr < atkStr) {
        attackerWins(arrayOfDefendingUnits, defendingUnitsSvgElement, arrayOfAttackingUnits, attackingUnitsSvgElement, defStr);
    } else {
        itsADraw(arrayOfAttackingUnits, attackingUnitsSvgElement, arrayOfDefendingUnits, defendingUnitsSvgElement);
    }
}

function itsADraw(arrayOfAttackingUnits, attackingUnitsSvgElement, arrayOfDefendingUnits, defendingUnitsSvgElement) {
    killUnits(arrayOfAttackingUnits, attackingUnitsSvgElement, true, 0);
    killUnits(arrayOfDefendingUnits, defendingUnitsSvgElement, true, 0);
    if (noUnitsRemaining(defendingUnitsSvgElement)) {
        removeActionMenu(defendingUnitsSvgElement.parentElement.childNodes[0]);
    }
    if (noUnitsRemaining(attackingUnitsSvgElement)) {
        removeActionMenu(attackingUnitsSvgElement.parentElement.childNodes[0]);
    }
}

function attackerWins(arrayOfDefendingUnits, defendingUnitsSvgElement, arrayOfAttackingUnits, attackingUnitsSvgElement, defStr) {
    let attackersIndex = getIndexValue(arrayOfAttackingUnits[0].parentElement);
    let defendersIndex = getIndexValue(arrayOfDefendingUnits[0].parentElement);

    let attackersSelectedUnits = attackingUnitsSvgElement.getElementsByClassName('selected');
    let attackingWith = {
        infantry: 0, ranged: 0, tanks: 0
    };
    for (let i = 0; i < attackersSelectedUnits.length; i++) {
        attackingWith[attackersSelectedUnits[i].classList[1]] = parseInt(attackersSelectedUnits[i].parentElement.childNodes[1].textContent)
    }

    game_socket.emit('resolveBattle', gameRoom, playerName, attackersIndex, defendersIndex, attackingWith);
}

function defenderWins(arrayOfAttackingUnits, attackingUnitsSvgElement, arrayOfDefendingUnits, defendingUnitsSvgElement, atkStr) {
    killUnits(arrayOfAttackingUnits, attackingUnitsSvgElement, true, 0);
    killUnits(arrayOfDefendingUnits, defendingUnitsSvgElement, false, atkStr);
    if (noUnitsRemaining(attackingUnitsSvgElement)) {
        removeActionMenu(attackingUnitsSvgElement.parentElement.childNodes[0]);
    }
}

function noUnitsRemaining(svgElement) {
    return svgElement.childElementCount === 0 && svgElement.parentElement.childElementCount === 2;
}

function deleteChild(parentTile, unitsToKill) {
    parentTile.removeChild(unitsToKill[0]);
    //todo: investigate this tryCatch further, removeChild seems to update the last
    //todo: iteration of removing a element from unitsToKill, i've tried
    //todo: wrapping this in a if check for unitsToKill.length but its
    //todo: saying there is an element to be updated and splice is reporting
    //todo: otherwise
    try {
        unitsToKill.splice(0, 1);
    } catch (e) {
        console.log("Error Caught: " + e);
    }
}

function killUnits(unitsToKill, parentTile, killAll, damageTaken) {
    let tilesIndex = getIndexValue(unitsToKill[0].parentElement);
    if (killAll) {
        game_socket.emit('removeAllUnitsInTile', gameRoom, tilesIndex);
        while (unitsToKill.length > 0) {
            deleteChild(parentTile, unitsToKill);
        }
    } else {
        let valueOfUnitsKilled = 0;
        while (damageTaken > valueOfUnitsKilled) {
            let currentUnitValue = parseInt(unitsToKill[0].getElementsByTagName('text')[0].innerHTML) - 1;
            game_socket.emit('minusOneFromUnitValue', gameRoom, tilesIndex, getUnitType(unitsToKill[0]));
            if (currentUnitValue === 0) {
                deleteChild(parentTile, unitsToKill);
            } else {
                unitsToKill[0].getElementsByTagName('text')[0].innerHTML = currentUnitValue;
            }
            valueOfUnitsKilled++;
        }
    }
    return unitsToKill;
}

function isBattleMovement(targetTile, selectedUnitsShapesToMove) {
    if (selectedUnitsShapesToMove.length === 0) {
        return false;
    } else if (tileHasUnits(targetTile)) {
        return (getRaceOfUnit(selectedUnitsShapesToMove) !== getUnitsRaceInTargetTile(targetTile));
    }
    return false;
}

function getUnitsRaceInTargetTile(targetTile) {
    return targetTile[0].parentElement.getElementsByTagName('g')[0].childNodes[0].classList[0];
}

function getRaceOfUnit(selectedUnitsShapesToMove) {
    return selectedUnitsShapesToMove[0].classList[0];
}

function resolvePeacefulMovement(targetTile, selectedUnitsShapesToMove) {
    function moveUnit(selectedUnitsShapesToMove) {
        if (selectedUnitsShapesToMove.length === 0) return;

        let shapeToMove = selectedUnitsShapesToMove[0];
        removeSelectedState(shapeToMove);

        if (tileHasUnits(targetTile)) {
            if (unitMergeRequired(targetTile, shapeToMove)) {
                console.log("mergeUnits " + shapeToMove.toString);
                mergeUnits(shapeToMove, targetTile, waitForUpdateAndLoopIfNeeded);
            } else {
                console.log("moveToNonHostileTarget " + shapeToMove.toString);
                moveToNonHostileTarget(targetTile, shapeToMove.parentElement, waitForUpdateAndLoopIfNeeded);
            }
        } else {
            console.log("no tileHasUnits -  moveToNonHostileTarget " + shapeToMove.toString);
            moveToNonHostileTarget(targetTile, shapeToMove.parentElement, waitForUpdateAndLoopIfNeeded);
        }
    }

    function waitForUpdateAndLoopIfNeeded() {
        if (selectedUnitsShapesToMove.length > 0) moveUnit(selectedUnitsShapesToMove);
    }

    moveUnit(selectedUnitsShapesToMove);
}

function moveToNonHostileTarget(target, unit, cb) {
    let originTile = unit.parentElement;

    let movementDetails = {
        gameRoom: gameRoom,
        originIndex: getIndexValue(originTile),
        targetIndex: getIndexValue(target[0]),
        unitType: getUnitType(unit),
        unitValue: getUnitValue(unit),
        unitRace: getUnitRace(unit)
    };

    game_socket.emit('peacefulMove', movementDetails, cb);

    target[0].parentElement.getElementsByTagName('svg')[0].appendChild(unit);
    if (originTile.childElementCount === 0) {
        removeActionMenu(originTile.parentElement.childNodes[0]);
    }
}

function removeActionMenu(menu) {
    let activeMenu = menu.getElementsByTagName('label')[0].classList.contains('ACTIVE');
    let index = parseInt(menu.getElementsByTagName('input')[0].name.replace("menu-open", ""));
    menu.parentElement.removeChild(menu);
    game_socket.emit('lockInOrder', "done", playerName, gameRoom, index);
    if (activeMenu) {
        highlightMoveOptions(index, false);
        game_socket.emit('refreshUsersInGame', gameRoom);
        setTimeout(function () {
            game_socket.emit('moveOrderComplete', gameRoom, playerName);
        }, 1000);
    }
}

function removeSelectedState(shapeToMove) {
    shapeToMove.classList.remove('selected');
    removeOnClickEvent(shapeToMove.parentElement);
}

function mergeUnits(shapeToMove, targetTile, cb) {
    let svgElement = shapeToMove.parentElement.parentElement;

    let newForces = parseInt(shapeToMove.parentElement
        .getElementsByTagName('text')[0]
        .innerHTML);

    let existingForces = parseInt(targetTile[0].parentElement
        .getElementsByTagName(shapeToMove.tagName)[0]
        .parentElement
        .getElementsByTagName('text')[0]
        .innerHTML);

    targetTile[0].parentElement
        .getElementsByTagName(shapeToMove.tagName)[0]
        .parentElement
        .getElementsByTagName('text')[0]
        .innerHTML = newForces + existingForces;

    let movementDetails = {
        gameRoom: gameRoom,
        originIndex: getIndexValue(svgElement),
        targetIndex: getIndexValue(targetTile[0]),
        unitType: getUnitType(shapeToMove.parentElement),
        unitValue: getUnitValue(shapeToMove.parentElement),
        unitRace: getUnitRace(shapeToMove.parentElement)
    };

    game_socket.emit('peacefulMerge', movementDetails, cb);

    let anyUnitsLeft = svgElement.childElementCount - 1;
    svgElement.removeChild(shapeToMove.parentElement);

    if (anyUnitsLeft === 0) {
        removeActionMenu(svgElement.parentElement.childNodes[0]);
    }
}

function unitMergeRequired(tile, shapeToMove) {
    return (tile[0].parentElement.getElementsByTagName(shapeToMove.tagName).length === 1);
}

function tileHasUnits(tileElement) {
    return (tileElement[0].parentElement.getElementsByTagName('g').length > 0);
}

function removeHarvestTokens() {
    let diamonds = document.getElementsByClassName("fa-diamond rotate");
    for (let i = 0; i < diamonds.length; i++) {
        let tile = diamonds[i].parentElement.parentElement.parentElement;
        let harvestOrderToken = tile.childNodes[0];
        tile.removeChild(harvestOrderToken);
    }
}

function deploymentCommitPhase(playersDefaultDeployments) {
    hideModal();
    displayDeploymentCommitTab(playersDefaultDeployments);
}

function deployingUnits(deploymentInfo) {
    if (deploymentInfo.nextPlayer === playerName) {
        displayDeploymentDeployTab(deploymentInfo);
    } else {
        displayModal("<h3>Waiting for " + deploymentInfo.nextPlayer + " to make their deployment</h3>");
        document.getElementById('game_hud_deployment_deploy_tab').style.display = 'none';
        if (document.getElementById('game_hud_deploy_deploy').classList.contains('activeHud')) {
            document.getElementById('game_hud_deploy_deploy').classList.remove('activeHud');
            document.getElementById('game_hud_deploy_deploy').classList.add('hiddenHudContainer');
            changedHUDView('game_hud', true);
        }
    }
}

function movementStepComplete(race) {
    if (race === getPlayersRace()) {
        let activeSvgElement = document.getElementsByClassName("menu-open-button ACTIVE")[0]
            .parentElement.parentElement.childNodes[1];

        if (noUnitsRemaining(activeSvgElement)) {
            removeActionMenu(document.getElementsByClassName("menu-open-button ACTIVE")[0].parentElement);
        } else {
            GetMapUnits(24, function (col, units) {
                let targetIndex = getIndexValue(activeSvgElement);
                let neighbouringTiles = targetIndex % 2 ? [-1, +1, -24, 23, 24, 25] : [-1, +1, -23, -24, -25, 24];
                updateTilesAfterBattleMovement(col, units, targetIndex, neighbouringTiles);
            });
        }
    }
}

function updateRoundPhaseInfo(data) {
    document.getElementById('round-value').textContent = "#" + data.round;
    document.getElementById('phase-value').textContent = data.phase;
    if (data.waitingOnPlayer[0].length < 1) {
        document.getElementById('waiting-on-value').textContent = "All Players Ready ";
    } else {
        document.getElementById('waiting-on-value').textContent = data.waitingOnPlayer;
    }
}

function populateModal(gameModalBody) {
    document.getElementById('gameModalBody').innerHTML = gameModalBody;
    document.getElementById('gameModal').classList.add('show');
    document.getElementById('gameModal').onclick = function () {
        document.getElementById('gameModal').classList.remove('show');
    };
}

function displayModal(modalBody, requiredInfo) {
    getActiveRaces(gameRoom, function (data) {
        if (data.indexOf(modalBody) > -1) {
            getRequiredInfo(modalBody, requiredInfo, function (data) {
                populateModal(data);
            });
        } else {
            populateModal(modalBody);
        }
    });
}

function hideModal() {
    let gameModal = document.getElementById('gameModal');
    if (gameModal.classList.contains('show')) {
        gameModal.classList.remove('show');
    }
}

function getRequiredInfo(modalBody, requiredInfo, cb) {
    function loadJSON(callback) {
        let url;
        if (requiredInfo === "history") {
            url = '/getRaceHistory/' + modalBody;
        } else if (requiredInfo === "leaderBio") {
            //leader hardcoded for now
            //TODO create controller for leader retrieval
            url = '/getLeaderBio/' + modalBody + '/attack';
        }

        let http = new XMLHttpRequest();
        http.overrideMimeType("application/json");
        http.open('GET', location.origin + url, true);
        http.onload = function () {
            if (http.readyState === 4 && http.status === "200") {
                callback(http.responseText);
            }
        };
        http.send();
    }

    loadJSON(function (response) {
        cb(JSON.parse(response));
    });
}

function getXValue(element) {
    return parseInt(element.parentElement.id[2]);
}

function getYValue(element) {
    return parseInt(element.parentElement.id[6]);
}

function getIndexValue(element) {
    let x = element.parentElement.id[2];
    let y = element.parentElement.id[6];
    return parseInt(x) + (parseInt(y) * 24);
}

function getIndexByHex(hexElement) {
    let x = hexElement.id[2];
    let y = hexElement.id[6];
    return parseInt(x) + (parseInt(y) * 24);
}

function getHexIdByIndex(index) {
    let intIndex = parseInt(index);
    return `x_${intIndex % 24}_y_${parseInt(intIndex / 24)}`;
}

function getUnitType(element) {
    return element.childNodes[0].classList[1];
}

function getUnitRace(element) {
    return element.childNodes[0].classList[0];
}

function getUnitValue(element) {
    return parseInt(element.childNodes[1].textContent);
}