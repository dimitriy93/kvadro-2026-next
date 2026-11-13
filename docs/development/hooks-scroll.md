# Scroll Hooks

Набор хуков для scroll-driven интерфейсов в React / Next.js.

Используется для:
- timeline
- parallax
- reveal-анимаций
- интерактивных секций

Хуки работают через `RefObject`, безопасны для SSR и не зависят от сторонних scroll-библиотек.

---

## useScrollProgress

Возвращает прогресс прокрутки элемента:

```
0 → 1
```

Используется для:
- заполнения линий таймлайна
- step-анимаций
- состояния секций

### API

```ts
const progress = useScrollProgress(
    elementRef,
    triggerRatio?
);
```

Параметры:

| Параметр | Описание |
|-|-|
| elementRef | Ref элемента |
| triggerRatio | Позиция активации в viewport |

---

### Пример

```tsx
const sectionRef = useRef<HTMLDivElement>(null);

const progress = useScrollProgress(
    sectionRef,
    0.6
);

return (
    <section ref={sectionRef}>

        <div
            style={{
                height: `${progress * 100}%`
            }}
        />

    </section>
);
```

---

# useScrollMotion

Возвращает физические параметры движения элемента:

```ts
{
    offset,
    velocity
}
```

Используется для:
- параллакса
- движения фоновых элементов
- реакций на скорость скролла


### API

```ts
const {
    offset,
    velocity
} = useScrollMotion(elementRef);
```

---

### Пример параллакса

```tsx
const imageRef = useRef<HTMLDivElement>(null);

const { offset } =
    useScrollMotion(imageRef);


<div
    ref={imageRef}
    style={{
        transform:
          `translateY(${offset * 0.2}px)`
    }}
/>
```

---

# useScrollProgress vs useScrollMotion

| Задача | Хук |
|-|-|
| Таймлайн | useScrollProgress |
| Индикатор прогресса | useScrollProgress |
| Появление блоков | useScrollProgress |
| Параллакс | useScrollMotion |
| Движение элементов | useScrollMotion |
| Реакция на скорость | useScrollMotion |

---

# Архитектура

Хуки разделяют две задачи:

### useScrollProgress

Логика состояния:

```
0 ---------------- 1
```

Пример:
"секция пройдена на 70%"


### useScrollMotion

Физика движения:

```
position + velocity
```

Пример:
"элемент движется быстрее/медленнее при скролле"

---

# Особенности

- SSR safe для Next.js
- очистка listeners при размонтировании
- можно использовать несколько раз на странице
- не требует GSAP или дополнительных scroll-библиотек