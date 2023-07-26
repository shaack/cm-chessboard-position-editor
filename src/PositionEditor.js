/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard-postion-editor
 * License: MIT, see file 'LICENSE'
 */
import {Extension} from "cm-chessboard/src/model/Extension.js"
import {PromotionDialog} from "cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"
import {INPUT_EVENT_TYPE} from "cm-chessboard/src/Chessboard.js"
import {MOVE_CANCELED_REASON} from "cm-chessboard/src/view/VisualMoveInput.js"
import {SelectPieceDialog} from "./extensions/SelectPieceDialog.js"

/*
ToDo
    - Castling
    - En passant
    - Take move back
    - Take all moves back
 */

export class PositionEditor extends Extension {

    constructor(chessboard) {
        super(chessboard)
        chessboard.addExtension(PromotionDialog)
        chessboard.addExtension(SelectPieceDialog)
        chessboard.enableMoveInput((event) => {
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
        chessboard.context.addEventListener("click", (event) => {
            this.onClick(event)
        })
    }

    onMoveInputCanceled(event) {
        // remove piece if it was moved out of the board
        if (event.reason === MOVE_CANCELED_REASON.movedOutOfBoard) {
            this.chessboard.setPiece(event.squareFrom, null)
        }
    }

    onValidateMoveInput(event) {
        return true
    }

    onMoveInputFinished(event) {
        if(event.squareTo) {
            this.handlePromotion(event)
        }
    }

    handlePromotion(event) {
        const piece = this.chessboard.getPiece(event.squareTo)
        const color = piece[0]
        const type = piece[1]
        if (type === "p" &&
            (color === "w" && event.squareTo[1] === "8" ||
                color === "b" && event.squareTo[1] === "1")) {
            this.chessboard.showPromotionDialog(event.squareTo, color, (promoteTo) => {
                console.log("promoteTo", promoteTo)
                this.chessboard.setPiece(promoteTo.square, promoteTo.piece, true)
            })
            return false
        }
        if (type === "k") {
            if (event.squareFrom[1] === "1" && event.squareTo[1] === "1" && color === "w" ||
                event.squareFrom[1] === "8" && event.squareTo[1] === "8" && color === "b") {

            }
        }
    }

    onClick(event) {
        const square = event.target.getAttribute("data-square")
        if (square && !this.chessboard.getPiece(square)) {
            this.chessboard.showSelectPieceDialog(square, (result) => {
                if(result) {
                    this.chessboard.setPiece(square, result.piece, true)
                }
            })
        }
    }
}
