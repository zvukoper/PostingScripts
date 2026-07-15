// ==UserScript==
// @name         Инструменты для соцсетей ЕР
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Добавляет плавающую кнопку для вставки хештегов #ЕР72#ЕдинаяРоссия и ссылок на соцсети
// @author       zvukoper
// @match        https://ok.ru/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/zvukoper/PostingScripts/main/posting.user.js
// @updateURL    https://raw.githubusercontent.com/zvukoper/PostingScripts/main/posting.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ----- НАСТРОЙКИ (можно менять) -----
    const TEXT_TO_INSERT = '\n\n#ЕР72#ЕдинаяРоссия\n\n🇷🇺 MAX | ВК | ТГ';
    const LINKS = [
        { word: 'MAX', url: 'https://max.ru/id7202106475_biz' },
        { word: 'ВК',  url: 'https://vk.ru/tyumenedinros' },
        { word: 'ТГ',  url: 'https://t.me/er_tyumen' }
    ];
    const MAX_WAIT_MS = 10000;
    const CHECK_INTERVAL_MS = 300;
    // ------------------------------------

    // ----- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ожидание элемента) -----
    function waitForElement(selector, timeout = MAX_WAIT_MS, interval = CHECK_INTERVAL_MS) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                    return;
                }
                if (Date.now() - startTime > timeout) {
                    clearInterval(timer);
                    reject(new Error(`Элемент "${selector}" не появился за ${timeout}мс`));
                }
            }, interval);
        });
    }

    // ----- ФУНКЦИЯ ОБРАБОТКИ ОДНОГО СЛОВА (вставка ссылки) -----
    async function processWord(word, url, editor) {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        let foundNode = null;
        let foundOffset = 0;
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.textContent;
            const index = text.indexOf(word);
            if (index !== -1) {
                foundNode = node;
                foundOffset = index;
                break;
            }
        }
        if (!foundNode) {
            throw new Error(`Слово "${word}" не найдено в редакторе.`);
        }

        const range = document.createRange();
        range.setStart(foundNode, foundOffset);
        range.setEnd(foundNode, foundOffset + word.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        console.log(`✅ Слово "${word}" выделено.`);

        const panel = await waitForElement('div.posting_form_media_text_menu_popover');
        const isVisible = panel.offsetParent !== null &&
                          panel.style.display !== 'none' &&
                          panel.style.visibility !== 'hidden';
        if (!isVisible) throw new Error('Панелька найдена, но скрыта.');
        console.log('✅ Панелька появилась.');

        const link = panel.querySelector('a.posting_form_media_text_menu_menu_i[title="Ссылка"]');
        if (!link) throw new Error('Ссылка "Ссылка" не найдена внутри панельки.');
        link.click();
        console.log('✅ Клик по ссылке "Ссылка" выполнен.');

        const input = await waitForElement('input.it.js-field_url[type="text"]');
        console.log('✅ Поле ввода появилось.');
        input.value = url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`✅ URL "${url}" вставлен.`);

        const confirmButton = await waitForElement('button.button-pro.js-posting-link-editor-confirm');
        const startTime = Date.now();
        let buttonReady = false;
        while (Date.now() - startTime < MAX_WAIT_MS) {
            if (!confirmButton.disabled && !confirmButton.classList.contains('__disabled')) {
                buttonReady = true;
                break;
            }
            await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
        }
        if (!buttonReady) throw new Error('Кнопка "Добавить" не стала активной.');
        console.log('✅ Кнопка активна.');
        confirmButton.click();
        console.log(`✅ Ссылка для "${word}" вставлена!`);
        await new Promise(r => setTimeout(r, 500));
    }

    // ----- ОСНОВНАЯ ФУНКЦИЯ (вставка текста в конец и обработка всех слов) -----
    async function insertLinks() {
        const editor = document.querySelector('div[contenteditable="true"]');
        if (!editor) {
            alert('❌ Редактор не найден. Откройте форму создания поста.');
            return;
        }

        editor.focus();

        // Устанавливаем курсор в конец редактора
        const sel = window.getSelection();
        const range = document.createRange();
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        let lastNode = null;
        while (walker.nextNode()) {
            lastNode = walker.currentNode;
        }
        if (lastNode) {
            range.setStart(lastNode, lastNode.textContent.length);
            range.setEnd(lastNode, lastNode.textContent.length);
        } else {
            const textNode = document.createTextNode('');
            editor.appendChild(textNode);
            range.setStart(textNode, 0);
            range.setEnd(textNode, 0);
        }
        sel.removeAllRanges();
        sel.addRange(range);

        // Вставляем текст в позицию курсора (в конец)
        document.execCommand('insertText', false, TEXT_TO_INSERT);
        console.log(`✅ Текст с хештегами и ссылками вставлен в конец.`);

        try {
            for (let item of LINKS) {
                await processWord(item.word, item.url, editor);
            }
            console.log('🎉 Все ссылки вставлены!');
            alert('✅ Готово! Хештеги и ссылки добавлены.');
        } catch (error) {
            alert(`❌ Ошибка: ${error.message}`);
            console.error(error);
        }
    }

    // ----- СОЗДАНИЕ ПЛАВАЮЩЕЙ КНОПКИ -----
    function createFloatingButton() {
        // Проверяем, не добавлена ли уже
        if (document.getElementById('ok-social-insert-btn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'ok-social-insert-btn';
        btn.textContent = 'Инструменты для соцсетей ЕР';
        // Фиксированное позиционирование
        btn.style.position = 'fixed';
        btn.style.top = '12px';
        btn.style.right = '12px';
        btn.style.zIndex = '999999';
        btn.style.backgroundColor = '#0059b3';
        btn.style.color = '#ffffff';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '14px';
        btn.style.padding = '8px 16px';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        btn.style.transition = 'background-color 0.2s, transform 0.1s';
        btn.style.whiteSpace = 'nowrap';

        // Эффект при наведении
        btn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#004080';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#0059b3';
        });
        // Эффект нажатия
        btn.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.95)';
        });
        btn.addEventListener('mouseup', function() {
            this.style.transform = 'scale(1)';
        });

        // Обработчик клика
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            insertLinks();
        });

        document.body.appendChild(btn);
        console.log('✅ Плавающая кнопка "Инструменты для соцсетей ЕР" добавлена.');
    }

    // Запускаем создание кнопки сразу, как только DOM готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFloatingButton);
    } else {
        createFloatingButton();
    }

    console.log('🚀 Скрипт "Инструменты для соцсетей ЕР" загружен.');
})();
