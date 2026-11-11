extends Node

enum BlockType {
	NONE = 0,           # 0 (no flags)
	RIGHT = 1,          # 1 (2^0)
	BOTTOM = 2,         # 2 (2^1)
	PLAYER = 4,         # 4 (2^2)
	BOMB = 8            # 8 (2^3)
}

func get_level_11_20():
	return [
	[
		[BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOMB, BlockType.NONE],
		[BlockType.RIGHT, BlockType.RIGHT |  BlockType.PLAYER, BlockType.RIGHT, BlockType.RIGHT, BlockType.BOTTOM,  BlockType.NONE, BlockType.BOTTOM, BlockType.BOMB],
		[BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.RIGHT, BlockType.NONE , BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT]
	],
	[
		[BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.NONE],
		[BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT,  BlockType.PLAYER | BlockType.RIGHT],
		[BlockType.BOMB, BlockType.RIGHT, BlockType.NONE, BlockType.RIGHT, BlockType.NONE, BlockType.RIGHT, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT | BlockType.BOTTOM, BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT]
	],
	[
		[BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.NONE],
		[BlockType.RIGHT, BlockType.PLAYER, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM | BlockType.RIGHT, BlockType.NONE, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM | BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.RIGHT, BlockType.RIGHT, BlockType.NONE, BlockType.NONE, BlockType.BOMB],
		[BlockType.RIGHT, BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.RIGHT,  BlockType.BOTTOM | BlockType.RIGHT,  BlockType.BOTTOM | BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT]
	],
	[
		[BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.NONE],
		[BlockType.BOMB, BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM | BlockType.RIGHT, BlockType.NONE, BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT,  BlockType.BOTTOM, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.PLAYER | BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT]
	],
	[
		[BlockType.NONE, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.NONE],
		[BlockType.RIGHT, BlockType.PLAYER | BlockType.RIGHT, BlockType.NONE, BlockType.NONE, BlockType.BOTTOM | BlockType.RIGHT, BlockType.NONE, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.RIGHT, BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.BOTTOM, BlockType.RIGHT, BlockType.RIGHT],
		[BlockType.RIGHT, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM, BlockType.BOTTOM | BlockType.RIGHT, BlockType.RIGHT],
		[BlockType.NONE, BlockType.NONE, BlockType.NONE, BlockType.NONE, BlockType.NONE, BlockType.NONE, BlockType.BOMB]
	]
	]
