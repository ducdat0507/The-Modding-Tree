var tmp = {}
var temp = tmp // Proxy for tmp
var funcs = {}
var NaNalert = false;

// Tmp will not call these
var activeFunctions = [
	"startData", "onPrestige", "doReset", "update", "automate",
	"buy", "buyMax", "respec", "onComplete", "onPurchase", "onPress", "onClick", "masterButtonPress",
	"sellOne", "sellAll", "pay",
]

var noCall = doNotCallTheseFunctionsEveryTick
for (item in noCall) {
	activeFunctions.push(noCall[item])
}

// Add the names of classes to traverse
var traversableClasses = []

function setupTemp() {
	tmp = {}
	tmp.pointGen = {}
	tmp.displayThings = []
	tmp.scrolled = 0
	funcs = {}
	
	setupTempData(layers, tmp, funcs)
	for (layer in layers){
		tmp[layer].resetGain = {}
		tmp[layer].nextAt = {}
		tmp[layer].nextAtDisp = {}
		tmp[layer].canReset = {}
		tmp[layer].notify = {}
		tmp[layer].prestigeNotify = {}
		tmp[layer].prestigeButtonText = {}
		tmp[layer].computedNodeStyle = []
		setupBarStyles(layer)
	}

	tmp.other = {
		screenWidth: window.innerWidth,
		lastPoints: player.points || new Decimal(0),
		oomps: new Decimal(0),
    }
	
	temp = tmp
}

function setupTempData(layerData, tmpData, funcsData) {
	for (item in layerData){
		if (layerData[item] == null) {
			tmpData[item] = null
		}
		else if (layerData[item] instanceof Decimal)
			tmpData[item] = layerData[item]
		else if (Array.isArray(layerData[item])) {
			tmpData[item] = []
			funcsData[item] = []
			setupTempData(layerData[item], tmpData[item], funcsData[item])
		}
		else if ((!!layerData[item]) && (layerData[item].constructor === Object)) {
			tmpData[item] = {}
			funcsData[item] = []
			setupTempData(layerData[item], tmpData[item], funcsData[item])
		}
		else if ((!!layerData[item]) && (typeof layerData[item] === "object") && traversableClasses.includes(layerData[item].constructor.name)) {
			tmpData[item] = new layerData[item].constructor()
			funcsData[item] = new layerData[item].constructor()
		}
		else if (isFunction(layerData[item]) && !activeFunctions.includes(item)){
			funcsData[item] = layerData[item]
			tmpData[item] = new Decimal(1) // The safest thing to put probably?
		} else {
			tmpData[item] = layerData[item]
		}
	}	
}

function updateTemp() {
	if (tmp === undefined)
		setupTemp()

	updateTempData(layers, tmp, funcs)

	for (layer in layers){
		tmp[layer].resetGain = getResetGain(layer)
		tmp[layer].nextAt = getNextAt(layer)
		tmp[layer].nextAtDisp = getNextAt(layer, true)
		tmp[layer].canReset = canReset(layer)
		tmp[layer].notify = shouldNotify(layer)
		tmp[layer].prestigeNotify = prestigeNotify(layer)
		tmp[layer].prestigeButtonText = prestigeButtonText(layer)
		constructBarStyles(layer)
		constructAchievementStyles(layer)
		constructNodeStyle(layer)
		updateChallengeDisplay(layer)

	}

	tmp.pointGen = getPointGen()
	tmp.displayThings = []
	for (thing in displayThings){
		let text = displayThings[thing]
		if (isFunction(text)) text = text()
		tmp.displayThings.push(text) 
	}

	tmp.other.oompsMag = 0

	var pp = new Decimal(player.points);
	var lp = tmp.other.lastPoints || new Decimal(0);
	if (pp.gt(lp)) {
		if (pp.gte("10^^8")) {
			pp = pp.slog(1e10)
			lp = lp.slog(1e10)
			tmp.other.oomps = pp.sub(lp).div(diff)
			tmp.other.oompsMag = -1;
		} else {
			while (pp.div(lp).log(10).div(diff).gte("100") && tmp.other.oompsMag <= 5 && lp.gt(0)) {
				pp = pp.log(10)
				lp = lp.log(10)
				tmp.other.oomps = pp.sub(lp).div(diff)
				tmp.other.oompsMag++;
			}
		}
	}

	tmp.other = {
		screenWidth: window.innerWidth,
		lastPoints: player.points,
		oomps: tmp.other.oomps,
		oompsMag: tmp.other.oompsMag,
	}

}

function updateTempData(layerData, tmpData, funcsData) {
	
	for (item in funcsData){
		if (Array.isArray(layerData[item])) {
			updateTempData(layerData[item], tmpData[item], funcsData[item])
		}
		else if ((!!layerData[item]) && (layerData[item].constructor === Object) || (typeof layerData[item] === "object") && traversableClasses.includes(layerData[item].constructor.name)){
			updateTempData(layerData[item], tmpData[item], funcsData[item])
		}
		else if (isFunction(layerData[item]) && !isFunction(tmpData[item])){
			let value = layerData[item]()
			if (value !== value || value === decimalNaN){
				if (NaNalert === true || confirm ("Invalid value found in tmp, named '" + item + "'. Please let the creator of this mod know! Would you like to try to auto-fix the save and keep going?")){
					NaNalert = true
					value = (value !== value ? 0 : decimalZero)
				}
				else {
					clearInterval(interval);
					player.autosave = false;
					NaNalert = true;
				}
			}


			Vue.set(tmpData, item, value)
		}
	}	
}

function updateChallengeTemp(layer)
{
	updateTempData(layers[layer].challenges, tmp[layer].challenges, funcs[layer].challenges)
	updateChallengeDisplay(layer)
}

function updateChallengeDisplay(layer) {
	for (id in player[layer].challenges) {
		let style = "locked"
		if (player[layer].activeChallenge == id && canCompleteChallenge(layer, id)) style = "canComplete"
		else if (hasChallenge(layer, id)) style = "done"
		tmp[layer].challenges[id].defaultStyle = style

		tmp[layer].challenges[id].buttonText = (player[layer].activeChallenge==(id)?(canCompleteChallenge(layer, id)?"Finish":"Exit Early"):(hasChallenge(layer, id)?"Completed":"Start"))
	}

}

function updateBuyableTemp(layer)
{
	updateTempData(layers[layer].buyables, tmp[layer].buyables, funcs[layer].buyables)
}

function updateClickableTemp(layer)
{
	updateTempData(layers[layer].clickables, tmp[layer].clickables, funcs[layer].clickables)
}

function constructNodeStyle(layer){
	let style = []
	if ((tmp[layer].isLayer && layerunlocked(layer)) || (!tmp[layer].isLayer && tmp[layer].canClick))
		style.push({'background-color': tmp[layer].color})
	if (tmp[layer].image !== undefined)
		style.push({'background-image': 'url("' + tmp[layer].image + '")'})
	style.push(tmp[layer].nodeStyle)
	Vue.set(tmp[layer], 'computedNodeStyle', style)
}




function constructAchievementStyles(layer){
	for (id in tmp[layer].achievements) {
		ach = tmp[layer].achievements[id]
		if (isPlainObject(ach)) {
			let style = []
			if (ach.image){ 
				style.push({'background-image': 'url("' + ach.image + '")'})
			} 
			if (!ach.unlocked) style.push({'visibility': 'hidden'})
			style.push(ach.style)
			Vue.set(ach, 'computedStyle', style)
		}
	}
}

function constructBarStyles(layer){
	if (layers[layer].bars === undefined)
		return
	for (id in layers[layer].bars){
		if (id !== "layer") {
			let bar = tmp[layer].bars[id]
			if (bar.progress instanceof Decimal)
				bar.progress = bar.progress.toNumber()
			bar.progress = (1 -Math.min(Math.max(bar.progress, 0), 1)) * 100

			bar.dims = {'width': bar.width + "px", 'height': bar.height + "px"}
			let dir = bar.direction
			bar.fillDims = {'width': (bar.width + 0.5) + "px", 'height': (bar.height + 0.5)  + "px"}
			if (dir !== undefined)
			{
				bar.fillDims['clip-path'] = 'inset(0% 50% 0% 0%)'
				if(dir == UP){
					bar.fillDims['clip-path'] = 'inset(' + bar.progress + '% 0% 0% 0%)'
				}
				else if(dir == DOWN){
					bar.fillDims['clip-path'] = 'inset(0% 0% ' + bar.progress + '% 0%)'
				}
				else if(dir == RIGHT){
					bar.fillDims['clip-path'] = 'inset(0% ' + bar.progress + '% 0% 0%)'
				}
				else if(dir == LEFT){
					bar.fillDims['clip-path'] = 'inset(0% 0% 0% ' + bar.progress + '%)'
				}

			}
		}

	}
}

function setupBarStyles(layer){
	if (layers[layer].bars === undefined)
		return
	for (id in layers[layer].bars){
		let bar = tmp[layer].bars[id]
		bar.dims = {}
		bar.fillDims = {}
	}
}