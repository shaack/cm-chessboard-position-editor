/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard-postion-editor
 * License: MIT, see file 'LICENSE'
 */
import {Extension} from "cm-chessboard/src/model/Extension.js"
import {
    PROMOTION_DIALOG_RESULT_TYPE,
    PromotionDialog
} from "cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"
import {COLOR, INPUT_EVENT_TYPE} from "cm-chessboard/src/Chessboard.js"
import {MOVE_CANCELED_REASON} from "cm-chessboard/src/view/VisualMoveInput.js"
import {SelectPieceDialog} from "./extensions/SelectPieceDialog.js"
import {MARKER_TYPE} from "cm-chessboard/src/extensions/markers/Markers.js"

const MARKER_TYPE_NEW_PIECE = {...MARKER_TYPE.frame}

export const POSITION_CHANGED_TYPE = {
    move: "move",
    capture: "capture",
    castling: "castling",
    promotion: "promotion",
    createPiece: "createPiece",
    removePiece: "removePiece"
}

export class PositionEditor extends Extension {

    /** @constructor */
    constructor(chessboard, props = {}) {
        super(chessboard)
        if (!chessboard.getExtension(PromotionDialog)) {
            chessboard.addExtension(PromotionDialog)
        }
        if (!chessboard.getExtension(SelectPieceDialog)) {
            chessboard.addExtension(SelectPieceDialog)
        }
        if (props.onPositionChanged) { // deprecated 2023-09-15
            console.warn("onPositionChanged is deprecated, use onPositionChange")
            props.onPositionChange = props.onPositionChanged
        }
        this.props = {
            autoSpecialMoves: true, // castling, en passant, promotion
            onPositionChange: undefined, // callback after each position change
            onEditorToggle: undefined // callback after the editor was enabled or disabled
        }
        Object.assign(this.props, props)
        this.clickListener = this.onSquareClick.bind(this)
        this.state = {
            dialogShown: false, // todo rename to selectPieceDialogShown
            chessboardState: null,
            enabled: false
        }
        // overwrite chessboard methods
        chessboard.enablePositionEditor = this.enable.bind(this)
        chessboard.disablePositionEditor = this.disable.bind(this)
    }

    enable() {
        if (this.state.enabled) {
            throw new Error("PositionEditor already enabled")
        }
        // copy the chessboard state
        this.state.chessboardState = {
            position: this.chessboard.getPosition(),
            orientation: this.chessboard.state.orientation,
            inputWhiteEnabled: this.chessboard.state.inputWhiteEnabled,
            inputBlackEnabled: this.chessboard.state.inputBlackEnabled,
            moveInputCallback: this.chessboard.state.moveInputCallback,
        }
        this.chessboard.disableMoveInput()
        // enable the free board
        this.chessboard.enableMoveInput((event) => {
            switch (event.type) {
                case INPUT_EVENT_TYPE.moveInputStarted:
                    return true
                case INPUT_EVENT_TYPE.moveInputCanceled:
                    return this.onMoveInputCanceled(event)
                case INPUT_EVENT_TYPE.validateMoveInput:
                    return this.onValidateMoveInput(event)
                case INPUT_EVENT_TYPE.moveInputFinished:
                    return this.onMoveInputFinished(event)
            }
        })
        this.chessboard.context.addEventListener("click", this.clickListener)
        this.state.enabled = true
        if (this.props.onEditorToggle) {
            this.props.onEditorToggle({enabled: true})
        }
    }

    disable() {
        if (!this.state.enabled) {
            throw new Error("PositionEditor not enabled")
        }
        // disable the free board
        this.chessboard.disableMoveInput()
        this.chessboard.context.removeEventListener("click", this.clickListener)
        // resume the chessboard state
        if (this.chessboard.getOrientation() !== this.state.chessboardState.orientation) {
            this.chessboard.setOrientation(this.state.chessboardState.orientation, false)
        }
        this.chessboard.setPosition(this.state.chessboardState.position, true)
        if (this.state.chessboardState.moveInputCallback) {
            let color
            if (this.state.chessboardState.inputWhiteEnabled && this.state.chessboardState.inputBlackEnabled) {
                color = undefined
            } else if (this.state.chessboardState.inputWhiteEnabled) {
                color = COLOR.white
            } else if (this.state.chessboardState.inputBlackEnabled) {
                color = COLOR.black
            } else {
                console.error("invalid state")
            }
            this.chessboard.enableMoveInput(this.state.chessboardState.moveInputCallback, color)
        }
        this.state.enabled = false
        if (this.props.onEditorToggle) {
            this.props.onEditorToggle({enabled: false})
        }
    }

    onMoveInputCanceled(event) {
        // remove piece if it was moved out of the board
        if (event.reason === MOVE_CANCELED_REASON.movedOutOfBoard) {
            this.chessboard.setPiece(event.squareFrom, null)
            if (this.props.onPositionChange) {
                this.props.onPositionChange({
                    position: this.chessboard.getPosition(),
                    type: POSITION_CHANGED_TYPE.removePiece
                })
            }
        }
    }

    onValidateMoveInput(event) {
        if (this.chessboard.getPiece(event.squareTo)) {
            this.captured = this.chessboard.getPiece(event.squareTo)
        } else {
            this.captured = null
        }
        return true
    }

    onMoveInputFinished(event) {
        let castling, enPassant, promotion
        if (event.squareTo && this.props.autoSpecialMoves) {
            castling = this.handleCastling(event)
            if (!castling) {
                enPassant = this.handleEnPassant(event)
                if (!enPassant) {
                    promotion = this.handlePromotion(event)
                }
            }
        }
        if (this.props.onPositionChange) {
            let type = POSITION_CHANGED_TYPE.move
            if (enPassant || this.captured) {
                type = POSITION_CHANGED_TYPE.capture
            } else if (castling) {
                type = POSITION_CHANGED_TYPE.castling
            }
            if (!promotion && event.legalMove) {
                this.props.onPositionChange({position: this.chessboard.getPosition(), type: type})
            }
        }
    }

    handlePromotion(event) {
        const piece = this.chessboard.getPiece(event.squareTo)
        const color = piece[0]
        const type = piece[1]
        if (type === "p" &&
            (color === COLOR.white && event.squareTo[1] === "8" ||
                color === COLOR.black && event.squareTo[1] === "1")) {
            // this.chessboard.movePiece(event.squareFrom, event.squareTo, false)
            this.chessboard.showPromotionDialog(event.squareTo, color, (result) => {
                if (result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
                    this.chessboard.setPiece(event.squareFrom, null, false)
                    this.chessboard.setPiece(result.square, result.piece, true)
                    if (this.props.onPositionChange) {
                        this.props.onPositionChange({
                            position: this.chessboard.getPosition(),
                            type: POSITION_CHANGED_TYPE.promotion
                        })
                    }
                } else {
                    this.chessboard.movePiece(event.squareTo, event.squareFrom, true)
                }
            })
            return true
        }
        return false
    }

    handleCastling(event) {
        const piece = this.chessboard.getPiece(event.squareTo)
        const color = piece[0]
        const type = piece[1]
        if (type === "k") {
            if (event.squareFrom[1] === "1" && event.squareTo[1] === "1" && color === COLOR.white) {
                if (event.squareFrom[0] === "e" && event.squareTo[0] === "g" && this.chessboard.getPiece("h1") === "wr") {
                    this.chessboard.movePiece("h1", "f1", true)
                    return true
                } else if (event.squareFrom[0] === "e" && event.squareTo[0] === "c" && this.chessboard.getPiece("a1") === "wr") {
                    this.chessboard.movePiece("a1", "d1", true)
                    return true
                }
            } else if (event.squareFrom[1] === "8" && event.squareTo[1] === "8" && color === COLOR.black) {
                if (event.squareFrom[0] === "e" && event.squareTo[0] === "g" && this.chessboard.getPiece("h8") === "br") {
                    this.chessboard.movePiece("h8", "f8", true)
                    return true
                } else if (event.squareFrom[0] === "e" && event.squareTo[0] === "c" && this.chessboard.getPiece("a8") === "br") {
                    this.chessboard.movePiece("a8", "d8", true)
                    return true
                }
            }
        }
        return false
    }

    handleEnPassant(event) {
        const piece = this.chessboard.getPiece(event.squareTo)
        const color = piece[0]
        const type = piece[1]
        if (type === "p") {
            const rankFrom = parseInt(event.squareFrom[1], 10)
            const rankTo = parseInt(event.squareTo[1], 10)
            const fileFrom = COLOR.black.charCodeAt(0) - event.squareFrom[0].charCodeAt(0) + 8
            const fileTo = COLOR.black.charCodeAt(0) - event.squareTo[0].charCodeAt(0) + 8
            if (color === COLOR.white && rankFrom === 5 && rankTo === 6 && Math.abs(fileFrom - fileTo) === 1 &&
                !this.captured && this.chessboard.getPiece(event.squareTo[0] + event.squareFrom[1]) === "bp") {
                this.chessboard.setPiece(event.squareTo[0] + event.squareFrom[1], null, true)
                return true
            }
            if (color === COLOR.black && rankFrom === 4 && rankTo === 3 && Math.abs(fileFrom - fileTo) === 1 &&
                !this.captured && this.chessboard.getPiece(event.squareTo[0] + event.squareFrom[1]) === "wp") {
                this.chessboard.setPiece(event.squareTo[0] + event.squareFrom[1], null, true)
                return true
            }
        }
        return false
    }

    onSquareClick(event) {
        const square = event.target.getAttribute("data-square")
        // console.log("onSquareClick", square, square ? this.chessboard.getPiece(square) : null)
        if (square && !this.chessboard.getPiece(square)) {
            if (!this.state.dialogShown) { // todo and not promotion dialog is shown
                this.chessboard.showSelectPieceDialog(square, (result) => {
                    if (result) {
                        this.chessboard.setPiece(square, result.piece, true)
                        if (this.props.onPositionChange) {
                            this.props.onPositionChange({
                                position: this.chessboard.getPosition(),
                                type: POSITION_CHANGED_TYPE.createPiece
                            })
                        }
                    }
                    setTimeout(() => {
                        this.state.dialogShown = false
                        this.chessboard.removeMarkers(MARKER_TYPE_NEW_PIECE, square)
                    })
                })
                this.chessboard.addMarker(MARKER_TYPE_NEW_PIECE, square)
            }
            this.state.dialogShown = true
        }
    }
}
