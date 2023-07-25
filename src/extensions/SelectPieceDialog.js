/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard-postion-editor
 * License: MIT, see file 'LICENSE'
 */
import {Extension, EXTENSION_POINT} from "cm-chessboard/src/model/Extension.js"
import {Svg} from "cm-chessboard/src/lib/Svg.js"
import {Utils} from "cm-chessboard/src/lib/Utils.js"

const DISPLAY_STATE = {
    hidden: "hidden",
    displayRequested: "displayRequested",
    shown: "shown"
}

export class SelectPieceDialog extends Extension {

    /** @constructor */
    constructor(chessboard) {
        super(chessboard)
        this.registerExtensionPoint(EXTENSION_POINT.redrawBoard, this.extensionPointRedrawBoard.bind(this))
        chessboard.showSelectPieceDialog = this.showSelectPieceDialog.bind(this)
        chessboard.isSelectPieceDialogShown = this.isSelectPieceDialogShown.bind(this)
        this.selectPieceDialogGroup = Svg.addElement(chessboard.view.interactiveTopLayer, "g", {class: "select-piece-dialog-group"})
        this.state = {
            displayState: DISPLAY_STATE.hidden,
            callback: null,
            dialogParams: {
                square: null,
                color: null
            }
        }
    }

    // public (chessboard.showPromotionDialog)
    showSelectPieceDialog(square, color, callback) {
        this.state.dialogParams.square = square
        this.state.dialogParams.color = color
        this.state.callback = callback
        this.setDisplayState(DISPLAY_STATE.displayRequested)
        setTimeout(() => {
                this.chessboard.view.positionsAnimationTask.then(() => {
                    this.setDisplayState(DISPLAY_STATE.shown)
                })
            }
        )
    }

    // public (chessboard.isPromotionDialogShown)
    isSelectPieceDialogShown() {
        return this.state.displayState === DISPLAY_STATE.shown ||
            this.state.displayState === DISPLAY_STATE.displayRequested
    }

    // private
    extensionPointRedrawBoard() {
        this.redrawDialog()
    }

    drawPieceButton(piece, point) {
        const squareWidth = this.chessboard.view.squareWidth
        const squareHeight = this.chessboard.view.squareHeight
        Svg.addElement(this.selectPieceDialogGroup,
            "rect", {
                x: point.x, y: point.y, width: squareWidth, height: squareHeight,
                class: "promotion-dialog-button",
                "data-piece": piece
            })
        this.chessboard.view.drawPiece(this.selectPieceDialogGroup, piece, point)
    }

    redrawDialog() {
        while (this.selectPieceDialogGroup.firstChild) {
            this.selectPieceDialogGroup.removeChild(this.selectPieceDialogGroup.firstChild)
        }
        if (this.state.displayState === DISPLAY_STATE.shown) {
            const squareWidth = this.chessboard.view.squareWidth
            const squareHeight = this.chessboard.view.squareHeight
            const squareCenterPoint = this.chessboard.view.squareToPoint(this.state.dialogParams.square)
            squareCenterPoint.x = squareCenterPoint.x + squareWidth / 2
            squareCenterPoint.y = squareCenterPoint.y + squareHeight / 2
            let turned = false
            const rank = parseInt(this.state.dialogParams.square.charAt(1), 10)
            if (this.chessboard.getOrientation() === COLOR.white && rank < 5 ||
                this.chessboard.getOrientation() === COLOR.black && rank >= 5) {
                turned = true
            }
            const offsetY = turned ? -4 * squareHeight : 0
            const offsetX = squareCenterPoint.x + squareWidth > this.chessboard.view.width ? -squareWidth : 0
            Svg.addElement(this.selectPieceDialogGroup,
                "rect", {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y + offsetY,
                    width: squareWidth,
                    height: squareHeight * 4,
                    class: "promotion-dialog"
                })
            const dialogParams = this.state.dialogParams
            if (turned) {
                this.drawPieceButton(PIECE[dialogParams.color + "q"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y - squareHeight
                })
                this.drawPieceButton(PIECE[dialogParams.color + "r"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y - squareHeight * 2
                })
                this.drawPieceButton(PIECE[dialogParams.color + "b"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y - squareHeight * 3
                })
                this.drawPieceButton(PIECE[dialogParams.color + "n"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y - squareHeight * 4
                })
            } else {
                this.drawPieceButton(PIECE[dialogParams.color + "q"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y
                })
                this.drawPieceButton(PIECE[dialogParams.color + "r"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y + squareHeight
                })
                this.drawPieceButton(PIECE[dialogParams.color + "b"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y + squareHeight * 2
                })
                this.drawPieceButton(PIECE[dialogParams.color + "n"], {
                    x: squareCenterPoint.x + offsetX,
                    y: squareCenterPoint.y + squareHeight * 3
                })
            }
        }
    }

    promotionDialogOnClickPiece(event) {
        if (event.button !== 2) {
            if (event.target.dataset.piece) {
                this.state.callback({square: this.state.dialogParams.square, piece: event.target.dataset.piece})
                this.setDisplayState(DISPLAY_STATE.hidden)
            } else {
                this.promotionDialogOnCancel(event)
            }
        }
    }

    promotionDialogOnCancel(event) {
        if (this.state.displayState === DISPLAY_STATE.shown) {
            event.preventDefault()
            this.setDisplayState(DISPLAY_STATE.hidden)
            this.state.callback(null)
        }
    }

    contextMenu(event) {
        event.preventDefault()
        this.setDisplayState(DISPLAY_STATE.hidden)
        this.state.callback(null)
    }

    setDisplayState(displayState) {
        this.state.displayState = displayState
        if (displayState === DISPLAY_STATE.shown) {
            this.clickDelegate = Utils.delegate(this.chessboard.view.svg,
                "mousedown",
                "*",
                this.promotionDialogOnClickPiece.bind(this))
            this.contextMenuListener = this.contextMenu.bind(this)
            this.chessboard.view.svg.addEventListener("contextmenu", this.contextMenuListener)
        } else if (displayState === DISPLAY_STATE.hidden) {
            this.clickDelegate.remove()
            this.chessboard.view.svg.removeEventListener("contextmenu", this.contextMenuListener)
        }
        this.redrawDialog()
    }
}

