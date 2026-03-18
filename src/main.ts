import { Block, Container, Entity, ItemStack, system, Vector3, world } from "@minecraft/server";

/**全プレイヤーの半径nブロックにあるブロックすべてに対して + プレイヤーがブロックを右クリックしたとき
ブロックがインベントリを持っていたら各スロットをすべてチェック
スロットのアイテムがバンドルなら削除 */

const CHECK_INTERVAL = world.getPackSettings()['tn:check_interval'] as number;

world.afterEvents.worldLoad.subscribe(() => {
  console.info('[BundleDisabler] Loaded!');
  console.info(`[BundleDisabler] 半径: ${world.getPackSettings()['tn:radius']}ブロック, チェック間隔: ${CHECK_INTERVAL}tick`);
});

system.runInterval(() => {
  const radius = world.getPackSettings()['tn:radius'] as number;
  for (const player of world.getPlayers()) {
    const { x, y, z } = player.location;
    const range = player.dimension.heightRange;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const pos = { x: x + dx, y: y + dy, z: z + dz };
          if (pos.y < range.min || range.max < pos.y) continue;
          const block = player.dimension.getBlock(pos);
          if (!block) continue;
          checkBlock(block);
        }
      }
    }

    // entity
    const entities = player.dimension.getEntities({
      location: player.location,
      maxDistance: radius,
    });

    for (const entity of entities) {
      checkEntity(entity);
    }
  }
}, CHECK_INTERVAL);

world.afterEvents.playerInteractWithBlock.subscribe(ev => {
  const block = ev.block;
  checkBlock(block);
});

world.afterEvents.entitySpawn.subscribe(ev => {
  if (!ev.entity.isValid) return;
  if (ev.entity.typeId !== 'minecraft:item') return;

  const itemComponent = ev.entity.getComponent("minecraft:item");
  if (!itemComponent) return;

  const itemStack = itemComponent.itemStack;
  if (isBundle(itemStack)) {
    const loc = ev.entity.location;
    ev.entity.remove();
    console.warn(`[BundleDisabler] ドロップしたバンドル (${formatLocation(loc)}) を削除しました`);
  }
});

function checkEntity(entity: Entity) {
  if (!entity.isValid) return;

  const inventoryComponent = entity.getComponent("minecraft:inventory");
  if (!inventoryComponent) return;

  const { container } = inventoryComponent;
  if (!container) return;

  const result = checkContainer(container);
  if (result > 0) {
    const loc = entity.location;
    console.warn(`[BundleDisabler] エンティティ ${entity.typeId} (${formatLocation(loc)}) から ${result} 個のバンドルを削除しました`);
  }
}

function checkBlock(block: Block) {
  if (!block.isValid) return;

  const inventoryComponent = block.getComponent("minecraft:inventory");
  if (!inventoryComponent) return;

  const { container } = inventoryComponent;
  if (!container) return;

  const result = checkContainer(container);
  if (result > 0) {
    console.warn(`[BundleDisabler] ブロック ${block.typeId} (${formatLocation(block.location)}) から ${result} 個のバンドルを削除しました`);
  }
}

/**
 * @returns removeされた個数
 */
function checkContainer(container: Container) {
  let removed = 0;
  for (let i = 0; i < container.size; i++) {
    const itemStack = container.getItem(i);
    if (!itemStack) continue;

    if (isBundle(itemStack)) {
      container.setItem(i);
      removed++;
    }
  }
  return removed;
}

function isBundle(itemStack: ItemStack) {
  return itemStack.hasComponent("minecraft:inventory");
}

function formatLocation(loc: Vector3) {
  return `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`;
}
