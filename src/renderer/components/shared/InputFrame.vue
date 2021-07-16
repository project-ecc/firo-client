<template>
    <div class="framed-input">
        <label>{{ label }}</label>
        <div class="frame">
            <slot />
        </div>
    </div>
</template>

<script>
export default {
    name: "FramedInput",
    props: ['label']
}
</script>

<style scoped lang="scss">
.framed-input {
    position: relative;
    height: 50px;

    label {
        position: absolute;
        left: 15px;
        font-size: 12px;
        letter-spacing: 0.4px;
        background-color: var(--color-background-sidebar);
        z-index: 2;
        padding: {
            left: 5px;
            right: 5px;
        }
    }

    .frame {
        position: absolute;
        top: 6px;
        bottom: 6px;
        right: 6px;
        left: 6px;

        height: 42px;
        border: {
            width: thin;
            style: solid;
            radius: 4px;
            color: var(--color-secondary-tag-background);
        }

        input {
            font-weight: bold;
            height: 100%;
            width: 100%;
            padding: {
                top: 11px;
                bottom: 11px;
                left: 14px;
                right: 14px;
            }
            background-color: inherit;
            border: none;
            outline: none;
        }
    }
}
</style>